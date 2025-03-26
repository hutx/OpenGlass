import * as React from 'react';
import { ActivityIndicator, Button, Image, ScrollView, Text, TextInput, View } from 'react-native';
import { rotateImage } from '../modules/imaging';
import { toBase64Image } from '../utils/base64';
import { Agent } from '../agent/Agent';
import { InvalidateSync } from '../utils/invalidateSync';
import { textToSpeech, transcribe2audio } from '../modules/openai';

function usePhotos(device: BluetoothRemoteGATTServer) {

    // Subscribe to device
    const [photos, setPhotos] = React.useState<Uint8Array[]>([]);
    const [audios, setAudios] = React.useState<Uint8Array[]>([]);
    const currentAudio = React.useRef<{ chunks: Map<number, Uint8Array>; expectedSize?: number; startTime: number; }>({ chunks: new Map(), startTime: 0 });
    const [subscribed, setSubscribed] = React.useState<boolean>(false);
    const bluService = React.useRef<BluetoothRemoteGATTService>();
    const photoControlCharacteristic = React.useRef<BluetoothRemoteGATTCharacteristic>();

    // 在组件顶层定义状态和引用
    const [audioSegments, setAudioSegments] = React.useState<File[]>([]);
    const [audioSegments2, setAudioSegments2] = React.useState<File[]>([]);
    const audioBuffer = React.useRef<Int16Array[]>([]);
    const recordingStartTime = React.useRef<number>(0);
    const currentDuration = React.useRef<number>(0);

    const audioBuffer2 = React.useRef<Int16Array[]>([]);
    const recordingStartTime2 = React.useRef<number>(0);
    const currentDuration2 = React.useRef<number>(0);

    const SAMPLE_RATE = 44100; // 根据实际设备配置调整
    const CHANNELS = 1;
    const BITS_PER_SAMPLE = 16;

    // WAV文件头生成函数
    const createWaveHeader = (dataLength: number) => {
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
        view.setUint32(28, SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE / 8, true); // 字节率
        view.setUint16(32, CHANNELS * BITS_PER_SAMPLE / 8, true); // 块对齐
        view.setUint16(34, BITS_PER_SAMPLE, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        return header;
    };

    const writeString = (view: DataView, offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // 保存音频段
    const saveAudioSegment = () => {
        // 检查是否有数据需要保存
        if (audioBuffer.current.length === 0) {
            console.log('No audio data to save');
            return;
        }

        try {
            // 合并缓冲区
            const totalSamples = audioBuffer.current.reduce((acc, arr) => acc + arr.length, 0);
            console.log(`Merging ${audioBuffer.current.length} audio chunks with total ${totalSamples} samples`);

            const merged = new Int16Array(totalSamples);
            let offset = 0;
            audioBuffer.current.forEach(arr => {
                merged.set(arr, offset);
                offset += arr.length;
            });

            // 应用音频处理（可选）
            // 例如：音量归一化、噪声抑制等

            // 生成WAV文件
            const header = createWaveHeader(merged.byteLength);
            const wavBuffer = new Uint8Array(header.byteLength + merged.byteLength);
            wavBuffer.set(new Uint8Array(header), 0);
            wavBuffer.set(new Uint8Array(merged.buffer), 44);

            // 创建文件对象
            const duration = currentDuration.current.toFixed(1);
            const timestamp = new Date(recordingStartTime.current).toISOString().replace(/[:.]/g, '-');
            const filename = `recording_${timestamp}_${duration}s.wav`;
            const file = new File([wavBuffer], filename, { type: 'audio/wav' });

            console.log(`Created WAV file: ${filename}, size: ${(wavBuffer.length / 1024).toFixed(2)} KB, duration: ${duration}s`);

            // 更新状态
            setAudioSegments(prev => {
                const newSegments = [...prev, file];
                console.log(`Total audio segments: ${newSegments.length}`);
                return newSegments;
            });

            // 重置缓冲区
            audioBuffer.current = [];
            currentDuration.current = 0;

            return file; // 返回创建的文件对象，方便后续处理
        } catch (error) {
            console.error('Error saving audio segment:', error);
            // 重置缓冲区，防止错误累积
            audioBuffer.current = [];
            currentDuration.current = 0;
            return null;
        }
    };

    // 保存音频段
    const saveAudioSegment2 = () => {
        // 检查是否有数据需要保存
        if (audioBuffer2.current.length === 0) {
            console.log('No audio data to save');
            return;
        }

        try {
            // 合并缓冲区
            const totalSamples = audioBuffer2.current.reduce((acc, arr) => acc + arr.length, 0);
            console.log(`Merging ${audioBuffer2.current.length} audio chunks with total ${totalSamples} samples`);

            const merged = new Int16Array(totalSamples);
            let offset = 0;
            audioBuffer2.current.forEach(arr => {
                merged.set(arr, offset);
                offset += arr.length;
            });

            // 应用音频处理（可选）
            // 例如：音量归一化、噪声抑制等
            // 生成WAV文件
            const header = createWaveHeader(merged.byteLength);
            const wavBuffer = new Uint8Array(header.byteLength + merged.byteLength);
            wavBuffer.set(new Uint8Array(header), 0);
            wavBuffer.set(new Uint8Array(merged.buffer), 44);

            // 创建文件对象
            const duration = currentDuration2.current.toFixed(1);
            const timestamp = new Date(recordingStartTime2.current).toISOString().replace(/[:.]/g, '-');
            const filename = `recording_${timestamp}_${duration}s.wav`;
            const file = new File([wavBuffer], filename, { type: 'audio/wav' });

            console.log(`Created WAV file: ${filename}, size: ${(wavBuffer.length / 1024).toFixed(2)} KB, duration: ${duration}s`);

            // 更新状态
            setAudioSegments2(prev => {
                const newSegments = [...prev, file];
                console.log(`Total audio segments: ${newSegments.length}`);
                return newSegments;
            });

            // 重置缓冲区
            audioBuffer2.current = [];
            currentDuration2.current = 0;

            return file; // 返回创建的文件对象，方便后续处理
        } catch (error) {
            console.error('Error saving audio segment:', error);
            // 重置缓冲区，防止错误累积
            audioBuffer2.current = [];
            currentDuration2.current = 0;
            return null;
        }
    };


    React.useEffect(() => {
        (async () => {

            let previousChunk = -1;
            let buffer: Uint8Array = new Uint8Array(0);
            function onChunk(id: number | null, data: Uint8Array) {

                // Resolve if packet is the first one
                if (previousChunk === -1) {
                    if (id === null) {
                        return;
                    } else if (id === 0) {
                        previousChunk = 0;
                        buffer = new Uint8Array(0);
                    } else {
                        return;
                    }
                } else {
                    if (id === null) {
                        console.log('Photo received', buffer);
                        rotateImage(buffer, '270').then((rotated) => {
                            console.log('Rotated photo', rotated);
                            setPhotos((p) => [...p, rotated]);
                        });
                        previousChunk = -1;
                        return;
                    } else {
                        if (id !== previousChunk + 1) {
                            previousChunk = -1;
                            console.error('Invalid chunk', id, previousChunk);
                            return;
                        }
                        previousChunk = id;
                    }
                }

                // Append data
                buffer = new Uint8Array([...buffer, ...data]);
            }


            // Subscribe for photo updates
            // 获取主服务（假设是自定义蓝牙服务）
            bluService.current = await device.getPrimaryService('19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase());
            // 获取图片数据特征值（用于接收通知）
            const photoCharacteristic = await bluService.current.getCharacteristic('19b10005-e8f2-537e-4f6c-d104768a1214');
            // 开启通知功能
            await photoCharacteristic.startNotifications();
            // 订阅通知
            setSubscribed(true);
            // 开启通知功能
            photoCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
                let value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
                console.log('Received photo chunk', value);
                let array = new Uint8Array(value.buffer);
                console.log('Received photo chunk array', array);
                // 处理数据包：0xff 0xff: 表示数据传输结束 其他情况：前两个字节组合为 packetId，后续字节为数据内容
                if (array[0] == 0xff && array[1] == 0xff) {
                    // 结束标记（如：空数据块）
                    onChunk(null, new Uint8Array());
                } else {
                    // 解析数据块ID和内容
                    let packetId = array[0] + (array[1] << 8);
                    let packet = array.slice(2);
                    onChunk(packetId, packet);
                }
            });
            // Start automatic photo capture every 5s
            // 获取拍照控制特征值（用于发送指令）
            photoControlCharacteristic.current = await bluService.current.getCharacteristic('19b10006-e8f2-537e-4f6c-d104768a1214');
            // 发送控制指令：每5秒自动拍照一次
            console.log('Start automatic photo capture prate', new Uint8Array([0x010]));

            await photoControlCharacteristic.current.writeValue(new Uint8Array([0x0 - 1]));
            // await photoControlCharacteristic.current.writeValue(new Uint8Array([0x010]));

            // 获取数据特征值（用于接收通知）
            const audioCharacteristic = await bluService.current.getCharacteristic('19b10001-e8f2-537e-4f6c-d104768a1214');
            // 开启通知功能
            await audioCharacteristic.startNotifications();

            const audioContext = new AudioContext();
            const audioSource = audioContext.createBufferSource();
            // 开启通知功能
            audioCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
                let value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
                let array = new Uint8Array(value.buffer);

                // 处理数据包：0xff 0xff: 表示数据传输结束 其他情况：前两个字节组合为 packetId，后续字节为数据内容
                if (array[0] === 0xff && array[1] === 0xff) {
                    // 结束标记，保存当前音频段
                    console.log('Audio transmission ended, saving segment');
                    saveAudioSegment();

                    // 可以在这里添加音频转录处理
                    if (audioSegments.length > 0) {
                        const latestAudio = audioSegments[audioSegments.length - 1];
                        // 创建临时URL以便访问文件
                        const audioUrl = URL.createObjectURL(latestAudio);
                        console.log('Processing audio file:', latestAudio.name, 'URL:', audioUrl);

                        // 这里可以添加音频转录代码
                        // 例如: transcribeAudio(audioUrl).then(result => console.log('Transcription:', result));
                    }
                } else {
                    // 初始化时间戳（如果是新的录音）
                    if (audioBuffer.current.length === 0) {
                        recordingStartTime.current = Date.now();
                        console.log('Started new audio recording at:', new Date(recordingStartTime.current).toISOString());
                    }

                    const dataView = new DataView(array.buffer);

                    // 处理音频数据 - 转换为Int16Array
                    // 如果前两个字节是包ID，则从第3个字节开始处理
                    const hasPacketId = true; // 根据实际情况设置
                    const dataOffset = hasPacketId ? 2 : 0;

                    // 确保数据长度有效且为偶数（16位采样需要2字节）
                    const availableBytes = Math.max(0, array.byteLength - dataOffset);
                    const dataLength = Math.floor(availableBytes / 2); // 16位采样，每个采样2字节

                    // 如果没有有效数据，则跳过处理
                    if (dataLength <= 0) {
                        console.warn('Received audio packet with insufficient data length');
                        return;
                    }

                    const samples = new Int16Array(dataLength);
                    for (let i = 0; i < dataLength; i++) {
                        // 确保不会越界访问
                        const byteOffset = dataOffset + i * 2;
                        if (byteOffset + 1 < array.byteLength) { // 确保有足够的字节可读取（需要2字节）
                            samples[i] = dataView.getInt16(byteOffset, true) * 2; // 应用增益，true表示小端序
                        } else {
                            console.warn(`Skipping sample at index ${i} due to insufficient data`);
                            break; // 中断循环，避免继续处理
                        }
                    }

                    // 累积音频数据
                    audioBuffer.current.push(samples);
                    currentDuration.current += samples.length / SAMPLE_RATE;

                    // 达到30秒触发保存
                    if (currentDuration.current >= 30) {
                        console.log('Reached 30s duration, saving audio segment');
                        saveAudioSegment();
                    }
                }
            });
        })();
    }, []);

    // 添加录音状态管理
    const [isRecording, setIsRecording] = React.useState<boolean>(false);

    const audioNodes = React.useRef<{
        stream?: MediaStream;
        audioContext?: AudioContext;
        source?: MediaStreamAudioSourceNode;
        processor?: ScriptProcessorNode;
    }>({});
    // 开始录音函数
    const startRecording = React.useCallback(async () => {
        console.log('Starting audio recording with Web Audio API...');
        try {
            // 请求麦克风权限
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,        // 降低采样率到标准CD音质
                    channelCount: 1,          // 使用单声道
                    echoCancellation: true,   // 开启回声消除
                    noiseSuppression: true,   // 开启降噪
                    autoGainControl: true     // 开启自动增益
                }
            });

            // 初始化音频上下文
            // const audioContext = new (window.AudioContext || window.webkitAudioContext)({
            //     sampleRate: SAMPLE_RATE
            // });
            const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });

            // 创建音频源节点
            const source = audioContext.createMediaStreamSource(stream);

            // 创建脚本处理节点（用于获取原始音频数据）
            const processor = audioContext.createScriptProcessor(4096, 1, 1);

            // 配置音频处理回调
            processor.onaudioprocess = (event) => {
                const inputBuffer = event.inputBuffer;
                const channelData = inputBuffer.getChannelData(0);

                // 将浮点数据转换为16位PCM
                const pcmData = new Int16Array(channelData.length);
                for (let i = 0; i < channelData.length; i++) {
                    pcmData[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
                }

                // 累积音频数据
                audioBuffer2.current.push(pcmData);
                currentDuration2.current += pcmData.length / SAMPLE_RATE;
            };

            // 保存节点引用以便停止
            audioNodes.current = {
                stream,
                audioContext,
                source,
                processor
            };

            // 连接处理链
            source.connect(processor);
            processor.connect(audioContext.destination);

            setIsRecording(true);
            recordingStartTime2.current = Date.now();
        } catch (error) {
            console.error('Error starting recording:', error);
            setIsRecording(false);
        }
    }, []);

    // 停止录音函数
    const stopRecording = React.useCallback(() => {
        console.log('Stopping audio recording...');
        try {
            // 断开所有音频节点
            if (audioNodes.current.processor) {
                audioNodes.current.processor.disconnect();
            }
            if (audioNodes.current.source) {
                audioNodes.current.source.disconnect();
            }
            if (audioNodes.current.stream) {
                audioNodes.current.stream.getTracks().forEach(track => track.stop());
            }
            if (audioNodes.current.audioContext) {
                audioNodes.current.audioContext.close();
            }
        } catch (error) {
            console.error('Error stopping recording:', error);
        }

        setIsRecording(false);
        // 保存当前录音并返回文件对象
        const audioFile = saveAudioSegment2();
        return audioFile;
    }, []);

    return [subscribed, photos, photoControlCharacteristic, isRecording, startRecording, stopRecording, audioSegments2] as const;
}

interface AudioState {
    mediaRecorder: MediaRecorder | null;
    stream: MediaStream | null;
    audioChunks: Blob[];
    recordStartTime: number | null;
    isRecording: boolean;
}

export const DeviceView = React.memo((props: { device: BluetoothRemoteGATTServer }) => {
    const [subscribed, photos, photoControlCharacteristic, isRecording, startRecording, stopRecording, audioSegments2] = usePhotos(props.device);
    const agent = React.useMemo(() => new Agent(), []);
    const agentState = agent.use();

    // Background processing agent
    const processedPhotos = React.useRef<Uint8Array[]>([]);
    const sync = React.useMemo(() => {
        let processed = 0;
        return new InvalidateSync(async () => {
            if (processedPhotos.current.length > processed) {
                let unprocessed = processedPhotos.current.slice(processed);
                processed = processedPhotos.current.length;
                await agent.addPhoto(unprocessed);
            }
        });
    }, []);
    React.useEffect(() => {
        processedPhotos.current = photos;
        sync.invalidate();
    }, [photos]);

    React.useEffect(() => {
        if (agentState.answer) {
            textToSpeech(agentState.answer)
        }
    }, [agentState.answer])

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {photos.map((photo, index) => (
                        <Image key={index} style={{ width: 100, height: 100 }} source={{ uri: toBase64Image(photo) }} />
                    ))}
                </View>
            </View>

            <View style={{ backgroundColor: 'rgb(28 28 28)', height: 600, width: 600, borderRadius: 64, flexDirection: 'column', padding: 64 }}>
                <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {agentState.loading && (<ActivityIndicator size="large" color={"white"} />)}
                    {agentState.answer && !agentState.loading && (<ScrollView style={{ flexGrow: 1, flexBasis: 0 }}><Text style={{ color: 'white', fontSize: 32 }}>{agentState.answer}</Text></ScrollView>)}
                </View>
                <TextInput
                    style={{ color: 'white', height: 64, fontSize: 32, borderRadius: 16, backgroundColor: 'rgb(48 48 48)', padding: 16 }}
                    placeholder='What do you need?'
                    placeholderTextColor={'#888'}
                    readOnly={agentState.loading}
                    onSubmitEditing={async (e) => {
                        await photoControlCharacteristic.current?.writeValue(new Uint8Array([0x0 - 1]));
                        setTimeout(() => { agent.answer(e.nativeEvent.text); }, 1000);
                    }}
                />
                <View style={{ marginTop: 10 }}>
                    <Button
                        title={isRecording ? '停止录音' : '语音输入'}
                        onPress={async () => {
                            if (isRecording) {
                                // 停止录音
                                // const { file, duration } = await stopAudio()
                                const audioFile = stopRecording();
                                if (audioFile) {
                                    // 调用转录API
                                    try {
                                        const transcriptionResult = await transcribe2audio(audioFile, "wav", "44100");
                                        console.log('Transcription result:', transcriptionResult);
                                        if (transcriptionResult && transcriptionResult.data) {
                                            // 将转录文本填入输入框并提交给agent
                                            agent.answer(transcriptionResult.data);
                                        }
                                    } catch (error) {
                                        console.error('Error transcribing audio:', error);
                                    }
                                }
                            } else {
                                // 开始录音
                                startRecording();
                                await photoControlCharacteristic.current?.writeValue(new Uint8Array([0x0 - 1]));
                            }
                        }}
                        color={isRecording ? '#ff4040' : '#2196F3'}
                    />
                </View>
            </View>
        </View>
    );
});