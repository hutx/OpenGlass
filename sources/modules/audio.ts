import { transcribeAudio } from './openai';
import fs from 'fs';

// 音频格式常量
export const AUDIO_CONSTANTS = {
  SAMPLE_RATE: 16000,
  CHANNELS: 1,
  BITS_PER_SAMPLE: 16
};

/**
 * 创建WAV文件头
 * @param dataLength 音频数据长度（字节）
 * @returns WAV文件头的ArrayBuffer
 */
export function createWaveHeader(dataLength: number) {
  const { SAMPLE_RATE, CHANNELS, BITS_PER_SAMPLE } = AUDIO_CONSTANTS;
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  
  // RIFF标识
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk大小
  view.setUint16(20, 1, true); // PCM格式
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE/8, true); // 字节率
  view.setUint16(32, CHANNELS * BITS_PER_SAMPLE/8, true); // 块对齐
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  return header;
}

/**
 * 写入字符串到DataView
 */
export function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * 将Int16Array音频数据转换为WAV文件Blob
 * @param audioData Int16Array格式的PCM音频数据
 * @returns WAV格式的Blob对象
 */
export function convertToWav(audioData: Int16Array): Blob {
  // 生成WAV文件
  const header = createWaveHeader(audioData.byteLength);
  const wavBuffer = new Uint8Array(header.byteLength + audioData.byteLength);
  wavBuffer.set(new Uint8Array(header), 0);
  wavBuffer.set(new Uint8Array(audioData.buffer), 44);

  // 创建Blob对象
  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * 处理音频文件并进行转录
 * @param audioFile 音频文件对象
 * @returns 转录结果的Promise
 */
export async function processAudioFile(audioFile: File) {
  try {
    // 创建临时URL以便访问文件
    const audioUrl = URL.createObjectURL(audioFile);
    console.log(`Processing audio file: ${audioFile.name}`);
    
    // 调用转录API
    const transcription = await transcribeAudio(audioUrl);
    
    // 释放URL
    URL.revokeObjectURL(audioUrl);
    
    return transcription;
  } catch (error) {
    console.error('Error processing audio file:', error);
    return null;
  }
}

/**
 * 应用音频增益
 * @param audioData 音频数据
 * @param gain 增益值（1.0表示不变）
 * @returns 应用增益后的新音频数据
 */
export function applyGain(audioData: Int16Array, gain: number): Int16Array {
  const processed = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    // 应用增益并防止溢出
    const sample = audioData[i] * gain;
    processed[i] = Math.max(Math.min(sample, 32767), -32768);
  }
  return processed;
}

/**
 * 检测音频是否包含有效语音
 * @param audioData 音频数据
 * @param threshold 能量阈值（0-1之间）
 * @returns 是否包含有效语音
 */
export function hasVoiceActivity(audioData: Int16Array, threshold: number = 0.02): boolean {
  // 计算音频能量
  let energy = 0;
  for (let i = 0; i < audioData.length; i++) {
    // 归一化到[-1,1]范围
    const normalizedSample = audioData[i] / 32768.0;
    energy += normalizedSample * normalizedSample;
  }
  
  // 计算平均能量
  energy = energy / audioData.length;
  
  console.log(`Audio energy level: ${energy}, threshold: ${threshold}`);
  
  // 与阈值比较
  return energy > threshold;
}