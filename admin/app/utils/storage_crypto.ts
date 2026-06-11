import { createCipheriv, createDecipheriv, createHash, pbkdf2Sync, randomBytes } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { Readable, Transform } from 'node:stream'
import {
  CONFIG_PATH,
  MONAD_SECURITY_VIOLATION,
  STORAGE_PATH,
  assertProjectReadPath,
  assertProjectWritePath,
} from './paths.js'

export const MONAD_CRYPTO_ERROR = 'MONAD_CRYPTO_ERROR'

const FILE_MAGIC = Buffer.from('MONADENC1')
const KEY_MAGIC = Buffer.from('MONADKEY1')
const HEADER_LENGTH_BYTES = 4
const AES_KEY_BYTES = 32
const GCM_IV_BYTES = 12
const GCM_TAG_BYTES = 16
const KEY_DERIVATION_ITERATIONS = 310_000
const KEY_FILE_PATH = join(CONFIG_PATH, 'key.bin')

type EnvelopeHeader = {
  version: 1
  alg: 'aes-256-gcm'
  iv: string
  plaintextLength?: number
  createdAt?: string
}

type WrappedKeyHeader = EnvelopeHeader & {
  kdf: 'pbkdf2-sha256'
  salt: string
  iterations: number
}

type ParsedEnvelope<THeader extends EnvelopeHeader> = {
  header: THeader
  headerBuffer: Buffer
  ciphertextStart: number
  ciphertextEnd: number
  authTag: Buffer
}

export type EncryptedStorageWriteStream = Transform & {
  storageDone: Promise<void>
}

let cachedDataKey: Buffer | null = null

function cryptoError(): never {
  throw new Error(MONAD_CRYPTO_ERROR)
}

function storageViolation(): never {
  throw new Error(MONAD_SECURITY_VIOLATION)
}

function isInsideRoot(root: string, path: string) {
  const rel = relative(root, path)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

export function isStoragePath(inputPath: string) {
  const safePath = assertProjectReadPath(inputPath)
  return isInsideRoot(STORAGE_PATH, safePath)
}

export function assertStorageReadPath(inputPath: string) {
  const safePath = assertProjectReadPath(inputPath)
  if (!isInsideRoot(STORAGE_PATH, safePath)) storageViolation()
  return safePath
}

export function assertStorageWritePath(inputPath: string) {
  const safePath = assertProjectWritePath(inputPath)
  if (!isInsideRoot(STORAGE_PATH, safePath)) storageViolation()
  return safePath
}

function parseKeyFromEnv(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  for (const encoding of ['base64', 'hex'] as const) {
    try {
      const decoded = Buffer.from(trimmed, encoding)
      if (decoded.length === AES_KEY_BYTES) return decoded
    } catch {
      // Try next encoding.
    }
  }

  return createHash('sha256').update(trimmed).digest()
}

function protectingSecret() {
  const secret =
    process.env.MONAD_ENCRYPTION_PASSWORD?.trim() ||
    process.env.MONAD_KEY_PASSWORD?.trim() ||
    process.env.APP_KEY?.trim()

  if (!secret) cryptoError()
  return secret
}

function deriveWrappingKey(secret: string, salt: Buffer) {
  return pbkdf2Sync(secret, salt, KEY_DERIVATION_ITERATIONS, AES_KEY_BYTES, 'sha256')
}

function packEnvelope(magic: Buffer, header: EnvelopeHeader, ciphertext: Buffer, tag: Buffer) {
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8')
  const headerLength = Buffer.alloc(HEADER_LENGTH_BYTES)
  headerLength.writeUInt32BE(headerBuffer.length, 0)
  return Buffer.concat([magic, headerLength, headerBuffer, ciphertext, tag])
}

function parseEnvelope<THeader extends EnvelopeHeader>(
  payload: Buffer,
  magic: Buffer
): ParsedEnvelope<THeader> {
  try {
    const minimumLength = magic.length + HEADER_LENGTH_BYTES + GCM_TAG_BYTES
    if (payload.length < minimumLength) cryptoError()
    if (!payload.subarray(0, magic.length).equals(magic)) cryptoError()

    const headerLength = payload.readUInt32BE(magic.length)
    const headerStart = magic.length + HEADER_LENGTH_BYTES
    const headerEnd = headerStart + headerLength
    const ciphertextEnd = payload.length - GCM_TAG_BYTES
    if (headerLength <= 0 || headerEnd > ciphertextEnd) cryptoError()

    const headerBuffer = payload.subarray(headerStart, headerEnd)
    const header = JSON.parse(headerBuffer.toString('utf8')) as THeader
    if (header.version !== 1 || header.alg !== 'aes-256-gcm' || !header.iv) cryptoError()

    return {
      header,
      headerBuffer,
      ciphertextStart: headerEnd,
      ciphertextEnd,
      authTag: payload.subarray(ciphertextEnd),
    }
  } catch (error) {
    if (error instanceof Error && error.message === MONAD_CRYPTO_ERROR) throw error
    cryptoError()
  }
}

function decryptEnvelope<THeader extends EnvelopeHeader>(
  payload: Buffer,
  magic: Buffer,
  key: Buffer
) {
  try {
    const parsed = parseEnvelope<THeader>(payload, magic)
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.header.iv, 'base64'))
    decipher.setAAD(parsed.headerBuffer)
    decipher.setAuthTag(parsed.authTag)
    return Buffer.concat([
      decipher.update(payload.subarray(parsed.ciphertextStart, parsed.ciphertextEnd)),
      decipher.final(),
    ])
  } catch {
    cryptoError()
  }
}

function wrapDataKey(dataKey: Buffer) {
  const salt = randomBytes(16)
  const iv = randomBytes(GCM_IV_BYTES)
  const wrappingKey = deriveWrappingKey(protectingSecret(), salt)
  const header: WrappedKeyHeader = {
    version: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    kdf: 'pbkdf2-sha256',
    salt: salt.toString('base64'),
    iterations: KEY_DERIVATION_ITERATIONS,
    createdAt: new Date().toISOString(),
  }
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8')
  const cipher = createCipheriv('aes-256-gcm', wrappingKey, iv)
  cipher.setAAD(headerBuffer)
  const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()])
  return packEnvelope(KEY_MAGIC, header, ciphertext, cipher.getAuthTag())
}

function unwrapDataKey(payload: Buffer) {
  const parsed = parseEnvelope<WrappedKeyHeader>(payload, KEY_MAGIC)
  if (
    parsed.header.kdf !== 'pbkdf2-sha256' ||
    parsed.header.iterations !== KEY_DERIVATION_ITERATIONS ||
    !parsed.header.salt
  ) {
    cryptoError()
  }

  const wrappingKey = deriveWrappingKey(
    protectingSecret(),
    Buffer.from(parsed.header.salt, 'base64')
  )
  const key = decryptEnvelope<WrappedKeyHeader>(payload, KEY_MAGIC, wrappingKey)
  if (key.length !== AES_KEY_BYTES) cryptoError()
  return key
}

function loadStorageKey() {
  if (cachedDataKey) return cachedDataKey

  const envKey =
    parseKeyFromEnv(process.env.MONAD_ENCRYPTION_KEY ?? '') ||
    parseKeyFromEnv(process.env.MONAD_STORAGE_KEY ?? '')
  if (envKey) {
    cachedDataKey = envKey
    return cachedDataKey
  }

  const keyPath = assertProjectWritePath(KEY_FILE_PATH)
  mkdirSync(dirname(keyPath), { recursive: true })

  if (existsSync(keyPath)) {
    cachedDataKey = unwrapDataKey(readFileSync(keyPath))
    return cachedDataKey
  }

  const dataKey = randomBytes(AES_KEY_BYTES)
  writeFileSync(keyPath, wrapDataKey(dataKey), { mode: 0o600 })
  try {
    chmodSync(keyPath, 0o600)
  } catch {
    // Best effort on filesystems that do not support chmod.
  }
  cachedDataKey = dataKey
  return cachedDataKey
}

function encryptedPayload(plaintext: Buffer) {
  const key = loadStorageKey()
  const iv = randomBytes(GCM_IV_BYTES)
  const header: EnvelopeHeader = {
    version: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    plaintextLength: plaintext.length,
    createdAt: new Date().toISOString(),
  }
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8')
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(headerBuffer)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return packEnvelope(FILE_MAGIC, header, ciphertext, cipher.getAuthTag())
}

export function isEncryptedStorageBuffer(payload: Buffer) {
  return (
    payload.length > FILE_MAGIC.length && payload.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)
  )
}

export async function writeEncryptedStorageFile(
  inputPath: string,
  data: string | Buffer,
  encoding: BufferEncoding = 'utf8'
) {
  const safePath = assertStorageWritePath(inputPath)
  await mkdir(dirname(safePath), { recursive: true })
  const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data, encoding)
  await writeFile(safePath, encryptedPayload(plaintext))
}

export async function readEncryptedStorageFile(inputPath: string): Promise<Buffer> {
  const safePath = assertStorageReadPath(inputPath)
  const payload = await readFile(safePath)
  return decryptEnvelope<EnvelopeHeader>(payload, FILE_MAGIC, loadStorageKey())
}

export function readEncryptedStorageFileSync(inputPath: string): Buffer {
  const safePath = assertStorageReadPath(inputPath)
  const payload = readFileSync(safePath)
  return decryptEnvelope<EnvelopeHeader>(payload, FILE_MAGIC, loadStorageKey())
}

export async function encryptFileIntoStorage(sourcePath: string, targetPath: string) {
  const source = assertProjectReadPath(sourcePath)
  const target = assertStorageWritePath(targetPath)
  await writeEncryptedStorageFile(target, await readFile(source))
}

export async function encryptStorageFileInPlace(inputPath: string) {
  const safePath = assertStorageWritePath(inputPath)
  const payload = await readFile(safePath)
  if (isEncryptedStorageBuffer(payload)) return
  await writeFile(safePath, encryptedPayload(payload))
}

export async function decryptStorageFileToMemory(inputPath: string, encoding: BufferEncoding) {
  return (await readEncryptedStorageFile(inputPath)).toString(encoding)
}

export async function deleteStorageFileIfExists(inputPath: string) {
  const safePath = assertStorageWritePath(inputPath)
  try {
    await unlink(safePath)
  } catch (error: any) {
    if (error?.code !== 'ENOENT') throw error
  }
}

export function getEncryptedStorageMetadata(inputPath: string) {
  const safePath = assertStorageReadPath(inputPath)
  try {
    const payload = readFileSync(safePath)
    const parsed = parseEnvelope<EnvelopeHeader>(payload, FILE_MAGIC)
    return {
      plaintextLength: parsed.header.plaintextLength ?? null,
      encryptedLength: payload.length,
    }
  } catch {
    cryptoError()
  }
}

export function createEncryptedStorageReadStream(inputPath: string): Readable {
  const safePath = assertStorageReadPath(inputPath)

  try {
    const payloadStats = statSync(safePath)
    const fd = openSync(safePath, 'r')
    try {
      const prefix = Buffer.alloc(FILE_MAGIC.length + HEADER_LENGTH_BYTES)
      readSync(fd, prefix, 0, prefix.length, 0)
      if (!prefix.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) cryptoError()

      const headerLength = prefix.readUInt32BE(FILE_MAGIC.length)
      const headerBuffer = Buffer.alloc(headerLength)
      readSync(fd, headerBuffer, 0, headerLength, prefix.length)
      const header = JSON.parse(headerBuffer.toString('utf8')) as EnvelopeHeader
      if (header.version !== 1 || header.alg !== 'aes-256-gcm' || !header.iv) cryptoError()

      const tag = Buffer.alloc(GCM_TAG_BYTES)
      readSync(fd, tag, 0, GCM_TAG_BYTES, payloadStats.size - GCM_TAG_BYTES)

      const decipher = createDecipheriv(
        'aes-256-gcm',
        loadStorageKey(),
        Buffer.from(header.iv, 'base64')
      )
      decipher.setAAD(headerBuffer)
      decipher.setAuthTag(tag)

      const ciphertextStart = prefix.length + headerLength
      const ciphertextEnd = payloadStats.size - GCM_TAG_BYTES - 1
      if (ciphertextEnd < ciphertextStart - 1) cryptoError()
      if (ciphertextEnd < ciphertextStart) {
        decipher.final()
        return Readable.from([])
      }

      return createReadStream(safePath, {
        start: ciphertextStart,
        end: ciphertextEnd,
      }).pipe(decipher)
    } finally {
      // createReadStream opens its own descriptor after the header has been parsed.
      try {
        closeSync(fd)
      } catch {}
    }
  } catch (error) {
    const stream = Readable.from([])
    process.nextTick(() =>
      stream.destroy(error instanceof Error ? error : new Error(MONAD_CRYPTO_ERROR))
    )
    return stream
  }
}

export function createEncryptedStorageWriteStream(
  inputPath: string,
  options: { plaintextLength?: number } = {}
): EncryptedStorageWriteStream {
  const safePath = assertStorageWritePath(inputPath)
  mkdirSync(dirname(safePath), { recursive: true })

  const key = loadStorageKey()
  const iv = randomBytes(GCM_IV_BYTES)
  const header: EnvelopeHeader = {
    version: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    plaintextLength: options.plaintextLength,
    createdAt: new Date().toISOString(),
  }
  const headerBuffer = Buffer.from(JSON.stringify(header), 'utf8')
  const headerLength = Buffer.alloc(HEADER_LENGTH_BYTES)
  headerLength.writeUInt32BE(headerBuffer.length, 0)

  const output = createWriteStream(safePath, { flags: 'w' })
  output.write(Buffer.concat([FILE_MAGIC, headerLength, headerBuffer]))

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(headerBuffer)

  const encryptor = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        callback(null, cipher.update(chunk))
      } catch {
        callback(new Error(MONAD_CRYPTO_ERROR))
      }
    },
    flush(callback) {
      try {
        const final = cipher.final()
        const tag = cipher.getAuthTag()
        callback(null, Buffer.concat([final, tag]))
      } catch {
        callback(new Error(MONAD_CRYPTO_ERROR))
      }
    },
  })

  encryptor.pipe(output)
  output.on('error', (error) => encryptor.destroy(error))
  encryptor.on('error', () => output.destroy())
  const encryptedStream = encryptor as EncryptedStorageWriteStream
  encryptedStream.storageDone = new Promise((resolve, reject) => {
    output.on('finish', resolve)
    output.on('error', reject)
    encryptor.on('error', reject)
  })
  return encryptedStream
}
