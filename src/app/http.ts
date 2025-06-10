import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';

const count = 30;
export const INDICES = Array.from(Array(count).keys());

@Injectable({ providedIn: 'root' })
export class Http {
  private trees = INDICES.map((index) => tree(5, 5, Math.floor(index / 4)));

  search(index: number, keyword: string): Observable<string[]> {
    console.log('==> [REQ]', { index, keyword });
    const res: string[] = [];
    search(this.trees[index], keyword.toLowerCase(), res);
    console.log('<== [RES]', res);
    return of(res).pipe(delay(Math.random() * 1000));
  }
}

type TreeNode = {
  title: string;
  path: string;
  children: TreeNode[];
};

function getName(depth: number): string {
  return String.fromCharCode(65 + depth);
}

function gen(
  width: number,
  depth: number,
  level: number,
  pathStart: string,
  index: number,
  offset: number,
): TreeNode {
  const title = `${getName(depth - level + offset)}=${index + 1}`;
  const path = pathStart === '' ? title : `${pathStart},${title}`;
  const children: TreeNode[] = [];

  if (level > 0) {
    for (let i = 0; i < width; i++) {
      children.push(gen(width, depth, level - 1, path, i, offset));
    }
  }

  return { title, path, children };
}

function tree(width: number, depth: number, offset: number): TreeNode {
  return gen(width, depth, depth, '', 0, offset);
}

function search(node: TreeNode, keyword: string, res: string[]): void {
  if (node.title.toLowerCase().includes(keyword)) {
    res.push(node.path);
  }

  for (const child of node.children) {
    search(child, keyword, res);
  }
}
