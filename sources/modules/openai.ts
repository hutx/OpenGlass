import axios from "axios";
import RNFS from "react-native-fs";
import SoundPlayer from "react-native-sound-player";
// import fs from "fs";
import { keys } from "../keys";
import { resolve } from "path";
import { rejects } from "assert";

export async function transcribe2audio(file: File, format: string, sample_rate: string) {

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('format', format);
        formData.append('sample_rate', sample_rate);

        const response = await axios.postForm("https://graph.hvyogo.com/tools/v1/transcribe/audio",
            formData, {
            headers: {
                'api-key': `sk-er5PD8UGi0I5QIuU9c73Dd44D4Bb4`,  // Replace YOUR_API_KEY with your actual OpenAI API key
                'Content-Type': 'multipart/form-data;'
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error in transcribeAudio:", error);
        return null; // or handle error differently
    }
}

export async function transcribeAudio(audioPath: string) {
    let audioBase64;

    try {
        // 检查是否是Blob URL (以blob:开头)
        if (audioPath.startsWith('blob:')) {
            // 从Blob URL获取数据
            const response = await fetch(audioPath);
            const blob = await response.blob();

            // 将Blob转换为Base64
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            audioBase64 = btoa(binary);
        } else {
            // 原有的文件路径处理方式
            audioBase64 = await RNFS.readFile(audioPath, { encoding: 'base64' });
        }

        const response = await axios.post("https://api.siliconflow.cn/v1/audio/transcriptions", {
            audio: audioBase64,
        }, {
            headers: {
                'Authorization': `Bearer sk-rrimmvfpgyrgewzyprftczsfzztulhtlglmtwhtqbaaipjyr`,  // Replace YOUR_API_KEY with your actual OpenAI API key
                'Content-Type': 'application/json'
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error in transcribeAudio:", error);
        return null; // or handle error differently
    }
}

let audioContext: AudioContext;

export async function startAudio() {
    audioContext = new AudioContext();
}

export async function textToSpeech(text: string) {
    try {
        // if (!audioContext) {
        //     audioContext = new AudioContext();
        // }

        const response = await axios.post("https://graph.hvyogo.com/tools/v1/audio/speech", {
            input: text,    // Use 'input' instead of 'text'
            model: "cosyvoice-v1",
            voice: 'longxiaochun',
        }, {
            headers: {
                'api-key': `sk-er5PD8UGi0I5QIuU9c73Dd44D4Bb4`,  // Replace YOUR_API_KEY with your actual OpenAI API key
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer'  // This will handle the binary data correctly

        });

        const fileName = `audio_${Date.now()}.mp3`;
        const filePath = `${RNFS.TemporaryDirectoryPath}/${fileName}`;
        
        // 转换 ArrayBuffer 为 Base64
        // const base64Data = Buffer.from(response.data).toString('base64');
        
        // await RNFS.writeFile(filePath, response.data, 'base64');

        // SoundPlayer.playUrl(filePath);
        // SoundPlayer.setVolume(0.8);

        // // Decode the audio data asynchronously
        // const audioBuffer = await audioContext.decodeAudioData(response.data);

        // // Create an audio source
        // const source = audioContext.createBufferSource();
        // source.buffer = audioBuffer;
        // source.connect(audioContext.destination);
        // source.start();  // Play the audio immediately

        return response.data;
    } catch (error) {
        console.error("Error in textToSpeech:", error);
        return null; // or handle error differently
    }
}

async function detectMimeType(arrayBuffer: ArrayBuffer) {
    const header = new Uint8Array(arrayBuffer.slice(0, 4));
    // 实现文件头检测逻辑
    return 'audio/mpeg'; // 默认返回MP3
}
// Function to convert image to base64
async function imageToBase64(path: string) {
    const image = await RNFS.readFile(path, { encoding: 'base64' });
    return `data:image/jpeg;base64,${image}`; // Adjust the MIME type if necessary (e.g., image/png)
}

export async function describeImage(imagePath: string) {
    const imageBase64 = imageToBase64(imagePath);
    try {
        const response = await axios.post("https://api.fe8.cn/v1/images/descriptions", {
            image: imageBase64,
        }, {
            headers: {
                'Authorization': `Bearer ${keys.openai}`,  // Replace YOUR_API_KEY with your actual OpenAI API key
                'Content-Type': 'application/json'
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error in describeImage:", error);
        return null; // or handle error differently
    }
}

export async function gptRequest(systemPrompt: string, userPrompt: string) {
    try {
        const response = await axios.post(`${keys.oneUrl}/chat/completions`, {
            model: "qwen2.5-32b-instruct",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        }, {
            headers: {
                'Authorization': `Bearer ${keys.oneKey}`,  // Replace YOUR_API_KEY with your actual OpenAI API key
                'Content-Type': 'application/json'
            },
        });
        return response.data;
    } catch (error) {
        console.error("Error in gptRequest:", error);
        return null; // or handle error differently
    }
}


textToSpeech("Hello I am an agent")
console.info(gptRequest(
    `
                You are a smart AI that need to read through description of a images and answer user's questions.

                This are the provided images:
                The image features a woman standing in an open space with a metal roof, possibly at a train station or another large building.
                She is wearing a hat and appears to be looking up towards the sky.
                The scene captures her attention as she gazes upwards, perhaps admiring something above her or simply enjoying the view from this elevated position.

                DO NOT mention the images, scenes or descriptions in your answer, just answer the question.
                DO NOT try to generalize or provide possible scenarios.
                ONLY use the information in the description of the images to answer the question.
                BE concise and specific.
            `
    ,
    'where is the person?'

))