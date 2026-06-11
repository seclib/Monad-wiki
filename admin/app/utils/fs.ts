import { mkdir, open, readdir, readFile, stat, unlink } from 'fs/promises'
import path, { join } from 'path'
import { FileEntry } from '../../types/files.js'
import { createReadStream } from 'fs'
import { LSBlockDevice, MonadDiskInfoRaw } from '../../types/system.js'
import {
  DATA_PATH,
  assertProjectReadPath,
  assertProjectWritePath,
  relativeProjectPath,
} from './paths.js'
import {
  createEncryptedStorageReadStream,
  getEncryptedStorageMetadata,
  isStoragePath,
  readEncryptedStorageFile,
} from './storage_crypto.js'

export const ZIM_STORAGE_PATH = join(relativeProjectPath(DATA_PATH), 'zim')
export const KIWIX_LIBRARY_XML_PATH = join(ZIM_STORAGE_PATH, 'kiwix-library.xml')

export async function listDirectoryContents(inputPath: string): Promise<FileEntry[]> {
  const safePath = assertProjectReadPath(inputPath)
  const entries = await readdir(safePath, { withFileTypes: true })
  const results: FileEntry[] = []
  for (const entry of entries) {
    if (entry.isFile()) {
      results.push({
        type: 'file',
        key: join(safePath, entry.name),
        name: entry.name,
      })
    } else if (entry.isDirectory()) {
      results.push({
        type: 'directory',
        prefix: join(safePath, entry.name),
        name: entry.name,
      })
    }
  }
  return results
}

export async function listDirectoryContentsRecursive(inputPath: string): Promise<FileEntry[]> {
  const safePath = assertProjectReadPath(inputPath)
  let results: FileEntry[] = []
  const entries = await readdir(safePath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = assertProjectReadPath(join(safePath, entry.name))
    if (entry.isDirectory()) {
      const subdirectoryContents = await listDirectoryContentsRecursive(fullPath)
      results = results.concat(subdirectoryContents)
    } else {
      results.push({
        type: 'file',
        key: fullPath,
        name: entry.name,
      })
    }
  }
  return results
}

export async function ensureDirectoryExists(path: string): Promise<void> {
  const safePath = assertProjectWritePath(path)
  try {
    await stat(safePath)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      await mkdir(safePath, { recursive: true })
    }
  }
}

export async function getFile(path: string, returnType: 'buffer'): Promise<Buffer | null>
export async function getFile(
  path: string,
  returnType: 'stream'
): Promise<NodeJS.ReadableStream | null>
export async function getFile(path: string, returnType: 'string'): Promise<string | null>
export async function getFile(
  path: string,
  returnType: 'buffer' | 'string' | 'stream' = 'buffer'
): Promise<Buffer | string | NodeJS.ReadableStream | null> {
  const safePath = assertProjectReadPath(path)
  try {
    if (isStoragePath(safePath)) {
      const plaintext = await readEncryptedStorageFile(safePath)
      if (returnType === 'string') return plaintext.toString('utf8')
      if (returnType === 'stream') return createEncryptedStorageReadStream(safePath)
      return plaintext
    }

    if (returnType === 'string') {
      return await readFile(safePath, 'utf-8')
    } else if (returnType === 'stream') {
      return createReadStream(safePath)
    }
    return await readFile(safePath)
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

export async function getFileStatsIfExists(
  path: string
): Promise<{ size: number; modifiedTime: Date } | null> {
  const safePath = assertProjectReadPath(path)
  try {
    const stats = await stat(safePath)
    if (isStoragePath(safePath) && stats.isFile()) {
      const metadata = getEncryptedStorageMetadata(safePath)
      return {
        size: metadata.plaintextLength ?? metadata.encryptedLength,
        modifiedTime: stats.mtime,
      }
    }

    return {
      size: stats.size,
      modifiedTime: stats.mtime,
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

/**
 * Validates that a file has the ZIM magic number (0x44D495A).
 * Must be called before passing a file to @openzim/libzim Archive,
 * because a corrupted ZIM causes a native C++ abort that cannot be
 * caught by JS try/catch.
 */
export async function isValidZimFile(filePath: string): Promise<boolean> {
  const safePath = assertProjectReadPath(filePath)
  let fh
  try {
    if (isStoragePath(safePath)) {
      const buf = (await readEncryptedStorageFile(safePath)).subarray(0, 4)
      if (buf.length < 4) return false
      return buf[0] === 0x5a && buf[1] === 0x49 && buf[2] === 0x4d && buf[3] === 0x04
    }

    fh = await open(safePath, 'r')
    const buf = Buffer.alloc(4)
    const { bytesRead } = await fh.read(buf, 0, 4, 0)
    if (bytesRead < 4) return false
    // ZIM magic number: 72 17 32 04 (little-endian 0x044D4953)
    return buf[0] === 0x5a && buf[1] === 0x49 && buf[2] === 0x4d && buf[3] === 0x04
  } catch {
    return false
  } finally {
    await fh?.close()
  }
}

export async function deleteFileIfExists(path: string): Promise<void> {
  const safePath = assertProjectWritePath(path)
  try {
    await unlink(safePath)
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

export function getAllFilesystems(
  device: LSBlockDevice,
  fsSize: MonadDiskInfoRaw['fsSize']
): MonadDiskInfoRaw['fsSize'] {
  const filesystems: MonadDiskInfoRaw['fsSize'] = []
  const seen = new Set()

  function traverse(dev: LSBlockDevice) {
    // Try to find matching filesystem
    const fs = fsSize.find((f) => matchesDevice(f.fs, dev.name))

    if (fs && !seen.has(fs.fs)) {
      filesystems.push(fs)
      seen.add(fs.fs)
    }

    // Traverse children recursively
    if (dev.children) {
      dev.children.forEach((child) => traverse(child))
    }
  }

  traverse(device)
  return filesystems
}

export function matchesDevice(fsPath: string, deviceName: string): boolean {
  // Remove /dev/ and /dev/mapper/ prefixes
  const normalized = fsPath.replace('/dev/mapper/', '').replace('/dev/', '')

  // Direct match (covers /dev/sda1 ↔ sda1, /dev/nvme0n1p1 ↔ nvme0n1p1)
  if (normalized === deviceName) {
    return true
  }

  // LVM/device-mapper: e.g., /dev/mapper/ubuntu--vg-ubuntu--lv contains "ubuntu--lv"
  if (fsPath.startsWith('/dev/mapper/') && fsPath.includes(deviceName)) {
    return true
  }

  return false
}

export function determineFileType(
  filename: string
): 'image' | 'pdf' | 'text' | 'epub' | 'zim' | 'unknown' {
  const ext = path.extname(filename).toLowerCase()
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext)) {
    return 'image'
  } else if (ext === '.pdf') {
    return 'pdf'
  } else if (['.txt', '.md', '.docx', '.rtf'].includes(ext)) {
    return 'text'
  } else if (ext === '.epub') {
    return 'epub'
  } else if (ext === '.zim') {
    return 'zim'
  } else {
    return 'unknown'
  }
}

/**
 * Sanitize a filename by removing potentially dangerous characters.
 * @param filename The original filename
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}
