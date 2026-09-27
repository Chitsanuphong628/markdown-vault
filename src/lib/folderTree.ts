export interface FolderInTree {
  id: string;
  parentId: string | null;
}

export interface VisibleFolderRow<T extends FolderInTree> {
  folder: T;
  depth: number;
  childCount: number;
}

/** Keep the API's sibling order while showing each folder at its saved depth. */
export function getVisibleFolderRows<T extends FolderInTree>(
  folders: readonly T[],
  openFolderIds: ReadonlySet<string>,
): VisibleFolderRow<T>[] {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const children = new Map<string, T[]>();
  const roots: T[] = [];

  for (const folder of folders) {
    let ancestor: T | undefined = folder;
    const seen = new Set([folder.id]);
    let cyclic = false;
    while (ancestor?.parentId) {
      const parent = byId.get(ancestor.parentId);
      if (!parent) break;
      if (seen.has(parent.id)) {
        cyclic = true;
        break;
      }
      seen.add(parent.id);
      ancestor = parent;
    }

    const parentId = folder.parentId;
    if (!parentId || !byId.has(parentId) || cyclic) {
      roots.push(folder);
    } else {
      const siblings = children.get(parentId) ?? [];
      siblings.push(folder);
      children.set(parentId, siblings);
    }
  }

  const rows: VisibleFolderRow<T>[] = [];
  const visit = (folder: T, depth: number) => {
    const descendants = children.get(folder.id) ?? [];
    rows.push({ folder, depth, childCount: descendants.length });
    if (openFolderIds.has(folder.id)) descendants.forEach(child => visit(child, depth + 1));
  };
  roots.forEach(folder => visit(folder, 0));
  return rows;
}
