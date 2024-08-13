import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'batteryStatus'
})
export class BatteryStatusPipe implements PipeTransform {

  transform(value: number | null): string {
    return value !== null ? `${value}%` : 'Memuat...';
  }

}