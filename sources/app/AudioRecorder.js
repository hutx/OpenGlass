class AudioRecorder{
    constructor(){
      this.mediaRecorder = null   // 媒体实例
      this.stream = null          // stream 音频流
      this.audioChunks = []       // 音频的数据
      this.recordStartTime = null // 录音了开始时间
      this.isRecording = false    // 是否开启录音
    }
  
    //初始化录音
    async init(){
      try {
        if(this.stream){
          this.stream.getTracks().forEach(track => track.stop());
        }
        this.mediaRecorder = null
  
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 44100,        // 降低采样率到标准CD音质
            channelCount: 1,          // 使用单声道
            echoCancellation: true,   // 开启回声消除
            noiseSuppression: true,   // 开启降噪
            autoGainControl: true     // 开启自动增益
          } 
        })
  
        // 'audio/mpeg',
        // 'audio/webm',
        // 'audio/webm;codecs=opus',
        // 'audio/ogg;codecs=opus',
        // 'audio/mp4'  
  
        // 使用标准音频
        const mimeType = 'audio/webm;codecs=opus'  // WebM 格式通常支持较好
  
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: mimeType,
          audioBitsPerSecond: 12800,  // 更高的比特率
        })
  
        // 设置ondataavailable事件处理
        this.mediaRecorder.ondataavailable = (event) => {
          if(event.data.size > 0){
            this.audioChunks.push(event.data)
          }
        }
  
        return true
      } catch (error) {
        console.error('录音初始化失败:', error)
        throw error // 抛出问题
      }
    }
  
    // 开始录音
    start(){
      if(!this.mediaRecorder || this.mediaRecorder.state !== 'inactive') return false
      try {
        this.audioChunks = [] 
        this.stream = null
        this.recordStartTime = Date.now()
        this.mediaRecorder.start(100) // 每100ms触发一次 ondataavailable，可以获取这100ms内的录音数据
        this.isRecording = true
        return true
      } catch (error) {
        console.error('开始录音失败:', error) 
        this.isRecording = false
        return false
      }
  
    }
  
    // 停止录音
    stop(){
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') return null
  
      return new Promise((resolve) =>{
  
        const startTime = this.recordStartTime
  
        // 设置 onstop 事件处理器
        this.mediaRecorder.onstop = () =>{
          const duration = Date.now() - startTime
          const audioBlob = new Blob(this.audioChunks, {type: this.mediaRecorder.mimeType})
          const audioFile = new File([audioBlob], `voice_${Date.now()}.mp3`, {
            type: this.mediaRecorder.mimeType
          })
  
  
  
          resolve({
            file: audioFile,
            duration: duration
          })
        }
  
        this.mediaRecorder.stop()
        this.isRecording = false
  
        if(this.stream){
          this.stream.getTracks().forEach(track => track.stop())
        }
  
        this.recordStartTime = null
  
      })
  
    }
  
  
    // 销毁实例
    destroy() {
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
      }
      this.mediaRecorder = null
      this.audioChunks = []
    }
  
  }
  
  export default AudioRecorder