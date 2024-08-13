import { Injectable } from '@angular/core';

declare var chrome: any;

@Injectable({
  providedIn: 'root',
})
export class TelloService {
  private telloAddress = '192.168.10.1';
  private telloPort = 8889;
  private socketId: number | null = null;

  private batteryStatusCallback: (status: number) => void = () => {};
  private lastResponseTime: number = 0;
  battery: number = 0;

  constructor() {
    document.addEventListener('deviceready', () => {
      this.createSocket();
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

  startReceiving() {
    if (this.socketId !== null) {
      chrome.sockets.udp.onReceive.addListener((info: any) => {
        if (info.socketId === this.socketId) {
          const message = new TextDecoder().decode(new Uint8Array(info.data));
          console.log('Pesan diterima:', message);
          // Asumsi pesan hanya berupa angka yang merepresentasikan tingkat baterai
          const batteryLevel = parseInt(message.trim(), 10);
          if (!isNaN(batteryLevel)) {
            this.battery = batteryLevel;
            console.log('Tingkat baterai:', this.battery);

            // Panggil callback dengan tingkat baterai terbaru
            if (this.batteryStatusCallback) {
              this.batteryStatusCallback(this.battery);
            }
            this.lastResponseTime = Date.now();
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
    // Jika lastResponseTime lebih dari 5 detik yang lalu, dianggap disconnected
    const currentTime = Date.now();
    return (currentTime - this.lastResponseTime) < 2000;
  }
}
