// 録画した連番JPEG(record-video.js が保存)から、QuickTimeで再生できるMP4(H.264・30fps固定)を書き出す。
// macOS標準の AVFoundation(QuickTimeと同じエンジン)だけを使い、ffmpeg等の外部ツールは使わない。
//
// 使い方: swift encode-mp4.swift <フレームのディレクトリ> <出力.mp4> <再生速度>
//   フレームのディレクトリには 0.jpg, 1.jpg, ... と frames.json({ times, end, width, height })を置く。
//   times は各フレームの記録時刻(秒)、end は記録終了時刻(秒)。画面に変化が無い間はフレームが来ないため、
//   30fpsの各時刻について「その時刻までに記録された最新のフレーム」を並べる(固定フレームレートの方が互換性が高い)。

import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

struct Meta: Decodable {
  let times: [Double]
  let end: Double
  let width: Int
  let height: Int
}

let args = CommandLine.arguments
guard args.count >= 4, let speed = Double(args[3]), speed > 0 else {
  print("使い方: swift encode-mp4.swift <フレームのディレクトリ> <出力.mp4> <再生速度>")
  exit(2)
}
let dir = URL(fileURLWithPath: args[1])
let out = URL(fileURLWithPath: args[2])
let meta = try JSONDecoder().decode(
  Meta.self, from: Data(contentsOf: dir.appendingPathComponent("frames.json")))

try? FileManager.default.removeItem(at: out)
let writer = try AVAssetWriter(outputURL: out, fileType: .mp4)
writer.shouldOptimizeForNetworkUse = true  // moovを先頭に置く(faststart)
let input = AVAssetWriterInput(
  mediaType: .video,
  outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: meta.width,
    AVVideoHeightKey: meta.height,
    AVVideoCompressionPropertiesKey: [
      AVVideoAverageBitRateKey: 6_000_000,
      AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
      AVVideoMaxKeyFrameIntervalDurationKey: 2.0,
      AVVideoExpectedSourceFrameRateKey: 30,
    ],
  ])
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
  assetWriterInput: input,
  sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: meta.width,
    kCVPixelBufferHeightKey as String: meta.height,
  ])
writer.add(input)
guard writer.startWriting() else {
  print("ERROR:", writer.error?.localizedDescription ?? "startWriting")
  exit(1)
}
writer.startSession(atSourceTime: .zero)

func pixelBuffer(_ index: Int) -> CVPixelBuffer {
  let url = dir.appendingPathComponent("\(index).jpg")
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    print("ERROR: フレームを読み込めません:", url.path)
    exit(1)
  }
  var created: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &created)
  let buffer = created!
  CVPixelBufferLockBaseAddress(buffer, [])
  let context = CGContext(
    data: CVPixelBufferGetBaseAddress(buffer),
    width: meta.width,
    height: meta.height,
    bitsPerComponent: 8,
    bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
  context.draw(image, in: CGRect(x: 0, y: 0, width: meta.width, height: meta.height))
  CVPixelBufferUnlockBaseAddress(buffer, [])
  return buffer
}

let fps = 30.0
let start = meta.times[0]
let frameCount = Int(((meta.end - start) / speed) * fps)
var sourceIndex = 0
var cached: (index: Int, buffer: CVPixelBuffer)?
for frame in 0..<frameCount {
  let t = Double(frame) / fps
  while sourceIndex + 1 < meta.times.count && (meta.times[sourceIndex + 1] - start) / speed <= t {
    sourceIndex += 1
  }
  while !input.isReadyForMoreMediaData {
    Thread.sleep(forTimeInterval: 0.005)
  }
  let buffer: CVPixelBuffer
  if let c = cached, c.index == sourceIndex {
    buffer = c.buffer
  } else {
    buffer = pixelBuffer(sourceIndex)
    cached = (sourceIndex, buffer)
  }
  if !adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(frame), timescale: 30)) {
    print("ERROR:", writer.error?.localizedDescription ?? "append")
    exit(1)
  }
}
input.markAsFinished()
let done = DispatchSemaphore(value: 0)
writer.finishWriting { done.signal() }
done.wait()
guard writer.status == .completed else {
  print("ERROR:", writer.error?.localizedDescription ?? "finishWriting")
  exit(1)
}
print("OK: \(frameCount)フレーム(\(String(format: "%.1f", Double(frameCount) / fps))秒)")
