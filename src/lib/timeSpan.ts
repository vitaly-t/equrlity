'use strict';

export function pad(str: string, length: number): string {
  str = String(str);
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}

export class TimeSpan {
  private msecPerSecond: number = 1000;
  private msecPerMinute: number = 60000;
  private msecPerHour: number = 3600000;
  private msecPerDay: number = 86400000;
  private msecs: number;

  constructor(milliseconds: number) {
    this.msecs = milliseconds;
  }

  addMilliseconds(milliseconds: number): TimeSpan {
    return new TimeSpan(this.msecs + milliseconds);
  }

  addSeconds(seconds: number): TimeSpan {
    return new TimeSpan(this.msecs + (seconds * this.msecPerSecond));
  }

  addMinutes(minutes: number): TimeSpan {
    return new TimeSpan(this.msecs + (minutes * this.msecPerMinute));
  }

  addHours(hours: number): TimeSpan {
    return new TimeSpan(this.msecs + (hours * this.msecPerHour));
  }

  addDays(days: number): TimeSpan {
    return new TimeSpan(this.msecs + (days * this.msecPerDay));
  }

  add(otherTimeSpan: TimeSpan): TimeSpan {
    return new TimeSpan(this.msecs + otherTimeSpan.totalMilliseconds());
  }

  subtract(otherTimeSpan: TimeSpan): TimeSpan {
    return new TimeSpan(this.msecs - otherTimeSpan.totalMilliseconds());
  }

  equals(otherTimeSpan: TimeSpan): boolean {
    return this.msecs === otherTimeSpan.totalMilliseconds();
  };

  // Getters
  totalMilliseconds(): number {
    return this.msecs;
  }

  totalSeconds(): number {
    return this.msecs / this.msecPerSecond;
  }

  totalMinutes(): number {
    return this.msecs / this.msecPerMinute;
  }

  totalHours(): number {
    return this.msecs / this.msecPerHour;
  }

  totalDays(): number {
    return this.msecs / this.msecPerDay;
  }

  milliseconds(): number {
    return this.msecs % this.msecPerSecond
  }

  seconds(): number {
    var ms = this.msecs % this.msecPerMinute
    return Math.floor(ms / this.msecPerSecond);
  }

  minutes(): number {
    var ms = this.msecs % this.msecPerHour
    return Math.floor(ms / this.msecPerMinute);
  }

  hours(): number {
    var ms = this.msecs % this.msecPerDay
    return Math.floor(ms / this.msecPerHour);
  }

  toString(): string {
    return this.toFormat("H:MI:SS");
  }

  toFormat(format: string): string {
    var replaceMap = {
      'hh': pad(this.hours().toString(), 2),
      'H': this.hours().toString(),
      'MI': pad(this.minutes().toString(), 2),
      'SS': pad(this.seconds().toString(), 2),
      'LLL': pad(this.milliseconds().toString(), 3)
    };
    var f = [format], i, l, s;
    var replace = function (str, rep) {
      var i = 0, l = f.length, j, ll, t, n = [];
      for (; i < l; i++) {
        if (typeof f[i] == 'string') {
          t = f[i].split(str);
          for (j = 0, ll = t.length - 1; j < ll; j++) {
            n.push(t[j]);
            n.push([rep]); // replacement pushed as non-string
          }
          n.push(t[ll]);
        } else {
          // must be a replacement, don't process, just push
          n.push(f[i]);
        }
      }
      f = n;
    };

    for (i in replaceMap) {
      replace(i, replaceMap[i]);
    }

    s = '';
    for (i = 0, l = f.length; i < l; i++)
      s += typeof f[i] == 'string' ? f[i] : f[i][0];
    return f.join('');
  }

  static FromSeconds(n: number): TimeSpan {
    return new TimeSpan(0).addSeconds(n);
  }

  static FromMinutes(n: number): TimeSpan {
    return new TimeSpan(0).addMinutes(n);
  }

  static FromHours(n: number): TimeSpan {
    return new TimeSpan(0).addHours(n);
  }

  static FromDays(n: number): TimeSpan {
    return new TimeSpan(0).addDays(n);
  }

  static FromDates(firstDate: Date, secondDate: Date): TimeSpan {
    var diff = secondDate.valueOf() - firstDate.valueOf();
    return new TimeSpan(diff);
  }

}

