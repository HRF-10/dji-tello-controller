import { Component, AfterViewInit, OnInit, NgZone } from '@angular/core';
import { TelloService } from '../services/udp.service';
import * as nipplejs from 'nipplejs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements AfterViewInit, OnInit {
  movementJoystick: any;
  directionalJoystick: any;
  private canSendCommand = true;
  private RC: number[] = [0, 0, 0, 0]; // RC[0] = Roll, RC[1] = Pitch, RC[2] = Throttle, RC[3] = Yaw

  battery: number | null = null;
  connection: string = 'Disconnected';

  cameraOn = true;

  constructor(private telloService: TelloService, private zone: NgZone) {}

  ngAfterViewInit() {
    this.initJoysticks();
    this.telloService.startReceivingVideo(); // Memulai penerimaan video setelah inisialisasi komponen
  }

  ngOnInit() {
    this.updateBatteryStatus();
    this.updateConnectionStatus();
    
    setInterval(() => {
      this.updateBatteryStatus();
      this.updateConnectionStatus();
    }, 3000);
  }

  updateBatteryStatus() {
    this.telloService.getBatteryStatus((status: number) => {
      console.log('Battery Status:', status);
      this.zone.run(() => {
        this.battery = status;
      });
    });
  }

  updateConnectionStatus() {
    const isConnected = this.telloService.checkConnectionStatus();
    console.log('Connection Status:', isConnected ? 'Connected' : 'Disconnected');
    this.connection = isConnected ? 'Connected' : 'Disconnected';
    if (!isConnected) {
      this.battery = null;
    }
  }

  initJoysticks() {
    const movementZone = document.getElementById('movement-joystick');
    const directionalZone = document.getElementById('directional-joystick');

    if (movementZone && directionalZone) {
      this.movementJoystick = nipplejs.create({
        zone: movementZone,
        mode: 'static',
        position: { left: '50%', bottom: '62px' },
        color: 'red',
        size: 125,
        dynamicPage: true,
      });

      this.directionalJoystick = nipplejs.create({
        zone: directionalZone,
        mode: 'static',
        position: { left: '50%', bottom: '62px' },
        color: 'blue',
        size: 125,
        dynamicPage: true,
      });

      this.movementJoystick.on('move', (_evt: any, data: any) => {
        this.handleMovementJoystick(data);
      });

      this.directionalJoystick.on('move', (_evt: any, data: any) => {
        this.handleDirectionalJoystick(data);
      });

      this.movementJoystick.on('end', () => this.resetRC());
      this.directionalJoystick.on('end', () => this.resetRC());
    } else {
      console.error('Joystick elements not found');
    }
  }

  handleDirectionalJoystick(data: any) {
    if (this.canSendCommand) {
      const angle = data.angle.degree;
      const strength = Math.round(data.distance);

      if (angle > 45 && angle <= 135) {
        this.RC[2] = strength; // Naik
      } else if (angle > 226 && angle <= 315) {
        this.RC[2] = -strength; // Turun
      } else if (angle > 135 && angle <= 225) {
        this.RC[3] = -strength; // Putar Kiri
      } else {
        this.RC[3] = strength; // Putar Kanan
      }

      this.sendCommand(`rc ${this.RC[0]} ${this.RC[1]} ${this.RC[2]} ${this.RC[3]}`);
    }
  }

  handleMovementJoystick(data: any) {
    if (this.canSendCommand) {
      const angle = data.angle.degree;
      const strength = Math.round(data.distance);

      if (angle > 45 && angle <= 135) {
        this.RC[1] = strength; // Kiri
      } else if (angle > 226 && angle <= 315) {
        this.RC[1] = -strength; // Kanan
      } else if (angle > 135 && angle <= 225) {
        this.RC[0] = -strength; // Mundur
      } else {
        this.RC[0] = strength; // Maju
      }

      this.sendCommand(`rc ${this.RC[0]} ${this.RC[1]} ${this.RC[2]} ${this.RC[3]}`);
    }
  }

  async sendCommand(command: string) {
    if (this.canSendCommand) {
      console.log(`Mengirim perintah: ${command}`);
      await this.telloService.sendCommand(command);
    }
  }

  resetRC() {
    this.RC = [0, 0, 0, 0];
    this.sendCommand('rc 0 0 0 0'); // Hentikan gerakan
  }

  async takeOff() {
    console.log('Perintah Take Off dikirim');
    await this.sendCommand('takeoff');
  }

  async land() {
    console.log('Perintah Landing dikirim');
    await this.sendCommand('land');
  }

  toggleCamera() {
    this.cameraOn = !this.cameraOn;
    if (this.cameraOn) {
      this.telloService.startVideoStream();
      this.telloService.startReceivingVideo();
    } else {
      this.telloService.stopVideoStream();
    }
  }
}