import type { TextSelection } from "./types";

export function saveSelection(containerEl: HTMLElement): TextSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (!containerEl.contains(selection.anchorNode)) return null;

  const range = selection.getRangeAt(0);

  return {
    start: getOffset(containerEl, range.startContainer, range.startOffset),
    end: getOffset(containerEl, range.endContainer, range.endOffset),
  };
}

function getOffset(
  containerEl: HTMLElement,
  targetNode: Node,
  targetOffset: number,
) {
  let charIndex = 0;
  const nodeStack: Node[] = [containerEl];
  let node: Node | undefined;

  while ((node = nodeStack.pop())) {
    if (node === targetNode) {
      if (node.nodeType === 3) return charIndex + targetOffset;
      for (let i = 0; i < targetOffset; i++) {
        charIndex += node.childNodes[i].textContent?.length || 0;
      }
      return charIndex;
    }

    if (node.nodeType === 3) {
      charIndex += node.nodeValue?.length || 0;
    } else {
      let i = node.childNodes.length;
      while (i--) nodeStack.push(node.childNodes[i]);
    }
  }

  return charIndex;
}

export function restoreSelection(
  containerEl: HTMLElement,
  savedSel: TextSelection | null,
) {
  if (!savedSel) return;
  let charIndex = 0;
  const range = document.createRange();
  range.setStart(containerEl, 0);
  range.collapse(true);

  const nodeStack: Node[] = [containerEl];
  let node: Node | undefined;
  let foundStart = false;
  let stop = false;

  while (!stop && (node = nodeStack.pop())) {
    if (node.nodeType === 3) {
      const nextCharIndex = charIndex + (node.nodeValue?.length || 0);
      if (
        !foundStart &&
        savedSel.start >= charIndex &&
        savedSel.start <= nextCharIndex
      ) {
        range.setStart(node, savedSel.start - charIndex);
        foundStart = true;
      }
      if (
        foundStart &&
        savedSel.end >= charIndex &&
        savedSel.end <= nextCharIndex
      ) {
        range.setEnd(node, savedSel.end - charIndex);
        stop = true;
      }
      charIndex = nextCharIndex;
    } else {
      let i = node.childNodes.length;
      while (i--) nodeStack.push(node.childNodes[i]);
    }
  }

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export function adjustCursorOffset(
  oldText: string,
  newText: string,
  cursor: number,
): number {
  if (oldText === newText) return cursor;

  let prefix = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefix < minLen && oldText[prefix] === newText[prefix]) prefix++;

  if (cursor <= prefix) return cursor;

  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    oldText[oldText.length - 1 - suffix] ===
      newText[newText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldChangedEnd = oldText.length - suffix;
  const newChangedEnd = newText.length - suffix;

  if (cursor >= oldChangedEnd) {
    return cursor + (newText.length - oldText.length);
  }

  return newChangedEnd;
}
