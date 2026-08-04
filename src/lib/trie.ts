export type TrieNode = {
  children: Map<string, TrieNode>;
  isWord: boolean;
};

export function createTrieNode(): TrieNode {
  return { children: new Map(), isWord: false };
}

export function insertWord(root: TrieNode, word: string): void {
  let node = root;
  for (const letter of word) {
    let child = node.children.get(letter);
    if (!child) {
      child = createTrieNode();
      node.children.set(letter, child);
    }
    node = child;
  }
  node.isWord = true;
}

export function buildTrie(words: readonly string[]): TrieNode {
  const root = createTrieNode();
  for (const word of words) {
    insertWord(root, word);
  }
  return root;
}
