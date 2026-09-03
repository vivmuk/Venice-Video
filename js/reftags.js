// Reference tags — the "@Image1 / @Element1" prompt syntax used by Venice's
// reference-to-video models.
//
// Venice indexes reference media *by position in the request array*, and the
// prompt addresses those positions by tag:
//
//   reference_image_urls[0]  ->  @Image1        (or scene_image_urls[0] on
//                                                elements-capable models)
//   elements[0]              ->  @Element1
//
// Users type these tags by hand, in every casing and spelling imaginable
// ("@image 1", "@ref2", "@character3"). This module is the single place that
// (a) rewrites whatever they typed into the exact canonical form the API
// expects, (b) renumbers tags when a reference is removed or reordered so the
// prompt keeps pointing at the right picture, and (c) reports tags that point
// at a slot which isn't filled.
//
// Every function here is pure and side-effect free except `insertAtCursor`.

(function (global) {
  'use strict';

  // Canonical kinds. The value is the exact spelling Venice expects.
  var KIND = { image: 'Image', element: 'Element' };

  // Every alias we accept for each kind. Longest-first inside each group so
  // "images" wins over "image" and "characters" over "char".
  var ALIASES = {
    image: ['images', 'image', 'imgs', 'img', 'pictures', 'picture', 'pics', 'pic',
            'photos', 'photo', 'references', 'reference', 'refs', 'ref'],
    element: ['elements', 'element', 'els', 'el', 'characters', 'character',
              'chars', 'char', 'subjects', 'subject', 'persons', 'person', 'people']
  };

  // @<alias><optional separator><number>. The separator allows "@image 1",
  // "@image-1", "@image_1", "@image#1" and "@image.1".
  var TAG_RE = new RegExp(
    '@\\s*(' + ALIASES.image.concat(ALIASES.element).join('|') + ')\\s*[-_.#]?\\s*(\\d{1,2})\\b',
    'gi'
  );

  function kindOfAlias(alias) {
    var a = String(alias).toLowerCase();
    return ALIASES.image.indexOf(a) !== -1 ? 'image'
         : ALIASES.element.indexOf(a) !== -1 ? 'element'
         : null;
  }

  /** Canonical tag text for a 1-based slot, e.g. label('image', 2) -> "@Image2". */
  function label(kind, n) {
    return '@' + (KIND[kind] || KIND.image) + n;
  }

  /**
   * Every tag in `text`, in document order.
   * @returns {Array<{kind:string, n:number, raw:string, start:number, end:number}>}
   */
  function scan(text) {
    var out = [];
    if (!text) return out;
    var re = new RegExp(TAG_RE.source, 'gi');
    var m;
    while ((m = re.exec(text)) !== null) {
      var kind = kindOfAlias(m[1]);
      if (!kind) continue;
      out.push({
        kind: kind,
        n: parseInt(m[2], 10),
        raw: m[0],
        start: m.index,
        end: m.index + m[0].length
      });
    }
    return out;
  }

  /**
   * Rewrite every recognised tag into its canonical form. This is what makes
   * "@ref 2", "@Image2" and "@picture-2" all reach the API as "@Image2".
   */
  function normalize(text) {
    if (!text) return text;
    return String(text).replace(new RegExp(TAG_RE.source, 'gi'), function (raw, alias, num) {
      var kind = kindOfAlias(alias);
      if (!kind) return raw;
      return label(kind, parseInt(num, 10));
    });
  }

  /**
   * Renumber the tags of one kind. `mapping` is { oldSlot: newSlot|null };
   * a null (or missing-from-mapping) target deletes the tag, which is what
   * happens when the reference it pointed at is removed.
   *
   * Substitution runs through a sentinel pass so a 2->1 / 3->2 shift can't
   * collide with a tag that was already rewritten.
   */
  function remap(text, kind, mapping) {
    if (!text) return text;
    // Non-printable sentinel so an in-flight rewrite can't be re-matched.
    var SENTINEL = '\u0000';
    var pass1 = String(text).replace(new RegExp(TAG_RE.source, 'gi'), function (raw, alias, num) {
      if (kindOfAlias(alias) !== kind) return raw;
      var from = parseInt(num, 10);
      if (!Object.prototype.hasOwnProperty.call(mapping, from)) return raw;
      var to = mapping[from];
      if (to === null || to === undefined) return SENTINEL + 'DROP' + SENTINEL;
      return SENTINEL + KIND[kind] + to + SENTINEL;
    });
    // Collapse a dropped tag together with one adjacent space so we don't
    // leave a double space behind.
    return pass1
      .replace(new RegExp(SENTINEL + 'DROP' + SENTINEL + '\\s?', 'g'), '')
      .replace(new RegExp(SENTINEL + '(\\w+)' + SENTINEL, 'g'), '@$1');
  }

  /**
   * Re-point the prompt at a different array. Used when the API rejects
   * `elements` for a model and we fall the images back into
   * `reference_image_urls` — the prompt has to follow them.
   *
   * @param offset how many slots the target array already holds, so element 1
   *               becomes @Image<offset+1>.
   */
  function retarget(text, fromKind, toKind, offset) {
    if (!text) return text;
    var shift = offset || 0;
    return String(text).replace(new RegExp(TAG_RE.source, 'gi'), function (raw, alias, num) {
      if (kindOfAlias(alias) !== fromKind) return raw;
      return label(toKind, parseInt(num, 10) + shift);
    });
  }

  /**
   * Compare the tags used in a prompt against the references actually attached.
   * @param counts { image: number, element: number }
   * @returns { dangling: Array<{kind,n}>, unused: Array<{kind,n}> }
   *   dangling — tag points at a slot with no reference in it (the API will
   *              read it as literal text, so it is worth warning about).
   *   unused   — a reference is attached but never mentioned in the prompt.
   */
  function audit(text, counts) {
    var have = { image: (counts && counts.image) || 0, element: (counts && counts.element) || 0 };
    var used = { image: {}, element: {} };
    var dangling = [];

    scan(text).forEach(function (t) {
      if (used[t.kind][t.n]) return;
      used[t.kind][t.n] = true;
      if (t.n < 1 || t.n > have[t.kind]) dangling.push({ kind: t.kind, n: t.n });
    });

    var unused = [];
    ['image', 'element'].forEach(function (kind) {
      for (var i = 1; i <= have[kind]; i++) {
        if (!used[kind][i]) unused.push({ kind: kind, n: i });
      }
    });

    return { dangling: dangling, unused: unused };
  }

  /**
   * Insert `tag` into a textarea/input at the caret, keeping single spaces on
   * both sides, and leave the caret after what was inserted.
   */
  function insertAtCursor(el, tag) {
    if (!el) return;
    var value = el.value || '';
    var start = typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length;
    var before = value.slice(0, start);
    var after = value.slice(end);

    var lead = before.length && !/\s$/.test(before) ? ' ' : '';
    var trail = after.length && !/^\s/.test(after) ? ' ' : '';
    var insert = lead + tag + trail;

    el.value = before + insert + after;
    var caret = before.length + lead.length + tag.length;
    el.setSelectionRange(caret, caret);
    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  global.RefTags = {
    KIND: KIND,
    label: label,
    scan: scan,
    normalize: normalize,
    remap: remap,
    retarget: retarget,
    audit: audit,
    insertAtCursor: insertAtCursor
  };
})(typeof window !== 'undefined' ? window : globalThis);
