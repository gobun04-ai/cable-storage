/**
 * 앱 아이콘(PNG)을 만든다.
 *
 * 이미지 라이브러리를 새로 들이지 않으려고 픽셀을 직접 채우고 PNG 로 인코딩한다.
 * 도형이 원과 둥근 사각형뿐이라 이 정도로 충분하다.
 *
 * 실행: npm run icons
 * 결과물은 public/ 에 만들어지며 한 번 만든 뒤에는 그대로 두면 된다.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// 앱 강조색(--accent #4f46e5)과 같은 인디고. 홈 화면 아이콘과 앱 색이 어긋나지 않게 맞춘다.
const BACKGROUND = [79, 70, 229]
const FOREGROUND = [255, 255, 255]

// ---------- PNG 인코딩 ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))

  return Buffer.concat([length, typeAndData, crc])
}

function encodePng(size, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // 비트 깊이
  ihdr[9] = 6 // 컬러 타입: RGBA
  ihdr[10] = 0 // 압축
  ihdr[11] = 0 // 필터
  ihdr[12] = 0 // 인터레이스 없음

  // 각 스캔라인 앞에 필터 바이트(0 = 필터 없음)를 붙인다
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- 그리기 ----------

/** 경계에서 계단이 보이지 않도록 가장자리 1px 을 부드럽게 섞는다. */
function coverage(distance, radius) {
  const edge = distance - radius
  if (edge <= -0.5) return 1
  if (edge >= 0.5) return 0
  return 0.5 - edge
}

function blend(target, offset, color, alpha) {
  if (alpha <= 0) return
  const inverse = 1 - alpha
  for (let i = 0; i < 3; i += 1) {
    target[offset + i] = Math.round(target[offset + i] * inverse + color[i] * alpha)
  }
  target[offset + 3] = Math.round(target[offset + 3] * inverse + 255 * alpha)
}

/** 둥근 사각형 안쪽까지의 거리. 바깥이면 양수. */
function roundedRectDistance(x, y, size, radius) {
  const half = size / 2
  const dx = Math.abs(x - half) - (half - radius)
  const dy = Math.abs(y - half) - (half - radius)
  const outerX = Math.max(dx, 0)
  const outerY = Math.max(dy, 0)
  return Math.sqrt(outerX * outerX + outerY * outerY) + Math.min(Math.max(dx, dy), 0) - radius
}

/**
 * 3심 케이블의 단면을 본뜬 도형.
 * 흰 고리(외피) 안에 도체 세 개가 들어 있다.
 */
function drawIcon(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4)

  // maskable 은 런처가 바깥을 잘라내므로 모서리를 둥글리지 않고 꽉 채운다
  const cornerRadius = maskable ? 0 : size * 0.22
  // 잘려도 도형이 남도록 안전 영역(가운데 80%) 안에 그린다
  const scale = maskable ? 0.66 : 0.82

  const center = size / 2
  const outerRadius = (size * scale) / 2
  const ringWidth = outerRadius * 0.16
  const innerRadius = outerRadius - ringWidth
  const coreRadius = outerRadius * 0.26
  const coreDistance = outerRadius * 0.44

  const cores = [-90, 30, 150].map((degrees) => {
    const radians = (degrees * Math.PI) / 180
    return [center + Math.cos(radians) * coreDistance, center + Math.sin(radians) * coreDistance]
  })

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      // 1) 배경
      const backgroundAlpha =
        cornerRadius === 0 ? 1 : coverage(roundedRectDistance(px, py, size, cornerRadius) + cornerRadius, cornerRadius)
      blend(pixels, offset, BACKGROUND, backgroundAlpha)

      // 2) 흰 고리 = 바깥 원에서 안쪽 원을 뺀 부분
      const distanceFromCenter = Math.hypot(px - center, py - center)
      const ringAlpha = Math.max(
        0,
        coverage(distanceFromCenter, outerRadius) - coverage(distanceFromCenter, innerRadius),
      )
      blend(pixels, offset, FOREGROUND, ringAlpha)

      // 3) 도체 세 개
      for (const [cx, cy] of cores) {
        blend(pixels, offset, FOREGROUND, coverage(Math.hypot(px - cx, py - cy), coreRadius))
      }
    }
  }

  return encodePng(size, pixels)
}

// ---------- 실행 ----------

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'favicon-48.png', size: 48, maskable: false },
]

for (const target of targets) {
  const png = drawIcon(target.size, { maskable: target.maskable })
  writeFileSync(join(OUT_DIR, target.file), png)
  console.log(`${target.file} (${target.size}x${target.size}, ${png.length} bytes)`)
}
