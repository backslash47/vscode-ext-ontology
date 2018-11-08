import * as fs from 'fs';
import * as path from 'path';

export function ensureDirExist(p: fs.PathLike) {
  if (fs.existsSync(p)) {
    if (fs.statSync(p).isFile()) {
      throw new Error(`Path ${p} is a file. Should be a directory.`);
    }
  } else {
    fs.mkdirSync(p, { recursive: true });
  }
}

export function fileNameFromPath(p: string) {
  const parsed = path.parse(p);

  return `${parsed.name}.${parsed.ext}`;
}
