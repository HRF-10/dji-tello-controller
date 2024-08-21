import { Injectable } from '@angular/core';

declare var chrome: any;
declare var JSMpeg: any;

@Injectable({
  providedIn: 'root',
})
export class TelloService {
  private telloAddress = '192.168.10.1';
  private telloPort = 8889;
  private videoPort = 11111;
  private socketId: number | null = null;
  private videoSocketId: number | null = null;

  private batteryStatusCallback: (status: number) => void = () => {};
  private lastResponseTime: number = 0;
  battery: number = 0;

  private player: any;

  constructor() {
    document.addEventListener('deviceready', () => {
      this.createSocket();
      this.createVideoSocket();
    }, false);
  }

  createSocket() {
    if (chrome && chrome.sockets && chrome.sockets.udp) {
      chrome.sockets.udp.create({}, (socketInfo: any) => {
        this.socketId = socketInfo.socketId;
        console.log('Socket dibuat dengan ID:', this.socketId);
        this.bindSocket();
      });
    } else {
      console.error('Socket UDP tidak tersedia. Pastikan plugin terinstal.');
    }
  }

  bindSocket() {
    if (this.socketId !== null) {
      chrome.sockets.udp.bind(this.socketId, '0.0.0.0', 0, (result: any) => {
        if (result < 0) {
          console.error('Gagal bind socket:', chrome.runtime.lastError);
        } else {
          console.log('Socket berhasil di-bind ke port yang tersedia');
          this.startReceiving();
        }
      });
    }
  }

  createVideoSocket() {
    if (chrome && chrome.sockets && chrome.sockets.udp) {
      chrome.sockets.udp.create({}, (socketInfo: any) => {
        this.videoSocketId = socketInfo.socketId;
        chrome.sockets.udp.bind(this.videoSocketId, '0.0.0.0', this.videoPort, (result: any) => {
          if (result < 0) {
            console.error('Gagal bind video socket:', chrome.runtime.lastError);
          } else {
            console.log('Socket video berhasil di-bind ke port:', this.videoPort);
          }
        });
      });
    }
  }

  startReceiving() {
    if (this.socketId !== null) {
      chrome.sockets.udp.onReceive.addListener((info: any) => {
        if (info.socketId === this.socketId) {
          try {
            const dataArray = new Uint8Array(info.data);
            console.log('Data Array:', dataArray);

            const message = new TextDecoder().decode(dataArray);
            console.log('Pesan diterima:', message);

            // Verifikasi bahwa message adalah string
            if (typeof message === 'string') {
              const batteryLevel = parseInt(message.trim(), 10);
              if (!isNaN(batteryLevel)) {
                this.battery = batteryLevel;
                console.log('Tingkat baterai:', this.battery);
                if (this.batteryStatusCallback) {
                  this.batteryStatusCallback(this.battery);
                }
                this.lastResponseTime = Date.now();
              }
            } else {
              console.error('Data yang diterima bukan string:', message);
            }
          } catch (error) {
            console.error('Kesalahan saat memproses data:', error);
          }
        }
      });
    }
  }

  startVideoReceiving() {
    this.sendCommand('streamon');

    if (this.videoSocketId !== null) {
      chrome.sockets.udp.onReceive.addListener((info: any) => {
        if (info.socketId === this.videoSocketId) {
          try {
            const dataArray = new Uint8Array(info.data);
            console.log('Data video diterima:', dataArray);
            const dataBlob = new Blob([dataArray], { type: 'video/mp4' });
            const url = URL.createObjectURL(dataBlob);

            if (!this.player) {
              const canvas = document.getElementById('drone-video') as HTMLCanvasElement;
              if (canvas) {
                this.player = new JSMpeg.Player(url, { canvas: canvas, autoplay: true });
              }
            } else {
              this.player.write(dataArray);
            }
          } catch (error) {
            console.error('Kesalahan saat memproses video data:', error);
          }
        }
      });
    }
  }

  sendCommand(command: string) {
    if (this.socketId !== null) {
      const data = new TextEncoder().encode(command);
      chrome.sockets.udp.send(this.socketId, data.buffer, this.telloAddress, this.telloPort, (sendInfo: any) => {
        if (sendInfo.resultCode < 0) {
          console.error('Pengiriman gagal:', chrome.runtime.lastError);
        } else {
          console.log('Perintah dikirim:', command);
        }
      });
    }
  }

  getBatteryStatus(callback: (status: number) => void) {
    this.batteryStatusCallback = callback;
    this.sendCommand('battery?');
  }

  checkConnectionStatus(): boolean {
    const currentTime = Date.now();
    return (currentTime - this.lastResponseTime) < 3000;
  }

  startVideoStream() {
    this.sendCommand('streamon');
  }

  stopVideoStream() {
    this.sendCommand('streamoff');
  }
}