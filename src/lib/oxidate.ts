"use strict";

import { pad, TimeSpan } from './timeSpan';

const daysAbbr: string[] = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat'
];

const daysFull: string[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const dayNames = {
  'su': 0,
  'sun': 0,
  'sunday': 0,
  'mo': 1,
  'mon': 1,
  'monday': 1,
  'tu': 2,
  'tue': 2,
  'tuesday': 2,
  'we': 3,
  'wed': 3,
  'wednesday': 3,
  'th': 4,
  'thu': 4,
  'thursday': 4,
  'fr': 5,
  'fri': 5,
  'friday': 5,
  'sa': 6,
  'sat': 6,
  'saturday': 6
};

const daysAll: string[] = [
  'su',
  'sun',
  'sunday',
  'mo',
  'mon',
  'monday',
  'tu',
  'tue',
  'tuesday',
  'we',
  'wed',
  'wednesday',
  'th',
  'thu',
  'thursday',
  'fr',
  'fri',
  'friday',
  'sa',
  'sat',
  'saturday'
];

const monthNames = {
  'jan': 0,
  'january': 0,
  'feb': 1,
  'february': 1,
  'mar': 2,
  'march': 2,
  'apr': 3,
  'april': 3,
  'may': 4,
  'jun': 5,
  'june': 5,
  'jul': 6,
  'july': 6,
  'aug': 7,
  'august': 7,
  'sep': 8,
  'september': 8,
  'oct': 9,
  'october': 9,
  'nov': 10,
  'november': 10,
  'dec': 11,
  'december': 11
};

const monthsFull: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

const monthsAbbr: string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
];

const daysInMonth: number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isInteger(str: string): boolean {
  if (str.match(/^(\d+)$/)) {
    return true;
  }
  return false;
}

var origParse = Date.parse;
// ------------------------------------------------------------------
// getDateFromFormat( date_string , format_string )
//
// This function takes a date string and a format string. It matches
// If the date string matches the format string, it returns the
// getTime() of the date. If it does not match, it returns null.
// ------------------------------------------------------------------

function getDateFromFormat(val: string, format: string): Date | null {
  var pos = 0;
  var getInt = function (minlength: number, maxlength: number): number | null {
    for (var x = maxlength; x >= minlength; x--) {
      var token = val.substring(pos, pos + x);
      if (token.length < minlength) {
        return null;
      }
      if (isInteger(token)) {
        pos += x
        return parseInt(token);
      }
    }
    return null;
  }
  var n;
  var iFormat = 0;
  var c = "";
  var token = "";
  var token2 = "";
  var x, y;
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var date = 1;
  var hh = 0;
  var mm = 0;
  var ss = 0;
  var ampm = "";

  while (iFormat < format.length) {
    // Get next token from format string
    c = format.charAt(iFormat);
    token = "";
    while ((format.charAt(iFormat) === c) && (iFormat < format.length)) {
      token += format.charAt(iFormat++);
    }
    // Extract contents of value based on format token
    if (token === "yyyy" || token === "yy" || token === "y") {
      if (token === "yyyy") {
        x = 4;
        y = 4;
      }
      if (token === "yy") {
        x = 2;
        y = 2;
      }
      if (token === "y") {
        x = 2;
        y = 4;
      }
      n = getInt(x, y);
      if (n === null) return null;
      if (n < 99) {
        if (n > 70) {
          year = 1900 + n;
        } else {
          year = 2000 + n;
        }
      }
      else year = n

    } else if (token === "MMM") {
      month = 0;
      for (var i = 10; i > 2; i--) {
        let cmon = val.substring(pos, pos + i).toLowerCase()
        let j = Object.keys(monthNames).indexOf(cmon)
        if (j > 0) {
          month = monthNames[cmon] + 1;
          pos += i;
          break;
        }
      }
      if (month === 0) return null;
    } else if (token === "EE" || token === "E") {
      date = 0;
      for (var i = 9; i > 2; i--) {
        let cday = val.substring(pos, pos + i).toLowerCase();
        let j = Object.keys(dayNames).indexOf(cday)
        if (j > 0) {
          date = dayNames[cday];
          pos += i;
          break;
        }
      }
      if (date === 0) return null;
    } else if (token === "MM" || token === "M") {
      month = getInt(1, 2);
      if (month === null || (month < 1) || (month > 12)) {
        return null;
      }
    } else if (token === "dd" || token === "d") {
      date = getInt(1, 2);
      if (date === null || (date < 1) || (date > 31)) {
        return null;
      }
    } else if (token === "hh" || token === "h") {
      hh = getInt(1, 2);
      if (hh === null || (hh < 1) || (hh > 12)) {
        return null;
      }
    } else if (token === "HH" || token === "H") {
      hh = getInt(1, 2);
      if (hh === null || (hh < 1) || (hh > 23)) {
        return null;
      }
    } else if (token === "mm" || token === "m") {
      mm = getInt(1, 2);
      if (mm === null || (mm < 0) || (mm > 59)) {
        return null;
      }
    } else if (token === "ss" || token === "s") {
      ss = getInt(1, 2);
      if (ss === null || (ss < 0) || (ss > 59)) {
        return null;
      }
    } else if (token === "a") {
      if (val.substring(pos, pos + 2).toLowerCase() === "am") {
        ampm = "AM";
      } else if (val.substring(pos, pos + 2).toLowerCase() === "pm") {
        ampm = "PM";
      } else {
        return null;
      }
      pos += 2;
    } else {
      if (val.substring(pos, pos + token.length) !== token) {
        return null;
      } else {
        pos += token.length;
      }
    }
  }
  // If there are any trailing characters left in the value, it doesn't match
  if (pos !== val.length) {
    return null;
  }
  // Is date valid for month?
  if (month === 2) {
    // Check for leap year
    if (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0)) { // leap year
      if (date > 29) {
        return null;
      }
    } else {
      if (date > 28) {
        return null;
      }
    }
  }
  else if ((month === 4) || (month === 6) || (month === 9) || (month === 11)) {
    if (date > 30) {
      return null;
    }
  }
  // Correct hours value
  if (hh < 12 && ampm === "PM") {
    hh += 12;
  } else if (hh > 11 && ampm === "AM") {
    hh -= 12;
  }
  return new Date(year, month - 1, date, hh, mm, ss);
};

let offsetMinutes = (new Date()).getTimezoneOffset();

export function parse(cdt: string, format: string): Date {
  return format ? getDateFromFormat(cdt, format) : new Date(cdt);
}

export function parseUTC(cdt: string, format: string): Date {
  let rslt = parse(cdt, format);
  return addMinutes(rslt, offsetMinutes);
}

export function validateDay(day: number, month: number, year: number): boolean {
  var date = new Date(year, month, day);
  return (date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day);
};

export function validateYear(year: number): boolean {
  return (year >= 0 && year <= 9999);
};

export function validateSecond(second: number): boolean {
  return (second >= 0 && second < 60);
};

export function validateMonth(month: number): boolean {
  return (month >= 0 && month < 12);
};

export function validateMinute(minute: number): boolean {
  return (minute >= 0 && minute < 60);
};

export function validateMillisecond(milli: number): boolean {
  return (milli >= 0 && milli < 1000);
};

export function validateHour(hour: number): boolean {
  return (hour >= 0 && hour < 24);
};

export function compare(date1: Date, date2: Date): number {
  if (date1.valueOf() < date2.valueOf()) {
    return -1;
  } else if (date1.valueOf() > date2.valueOf()) {
    return 1;
  }
  return 0;
};

export function equals(date1: Date, date2: Date): boolean {
  return date1.valueOf() === date2.valueOf();
};

export function getDayNumberFromName(name: string): string {
  return dayNames[name.toLowerCase()];
};


export function getMonthNumberFromName(name: string): number {
  return monthNames[name.toLowerCase()];
};

export function getMonthNameFromNumber(number: number): string {
  return monthsFull[number];
};

export function getMonthAbbrFromNumber(number: number): string {
  return monthsAbbr[number];
};

export function isLeapYear(year: number): boolean {
  return (new Date(year, 1, 29).getDate() === 29);
};

export function getDaysInMonth(year: number, month: number): number {
  if (month === 1) {
    return isLeapYear(year) ? 29 : 28;
  }
  return daysInMonth[month];
};

export function add(date: Date, ts: TimeSpan): Date {
  var ms = date.valueOf() + ts.totalMilliseconds();
  return new Date(ms);
};

export function addDays(date: Date, n: number): Date {
  return add(date, TimeSpan.FromDays(n));
};

export function addHours(date: Date, n: number): Date {
  return add(date, TimeSpan.FromHours(n));
};

export function addMinutes(date: Date, n: number): Date {
  return add(date, TimeSpan.FromMinutes(n));
};

export function addSeconds(date: Date, n: number): Date {
  return add(date, TimeSpan.FromSeconds(n));
};

export function addMilliseconds(date: Date, n: number): Date {
  return add(date, new TimeSpan(n));
};

export function getMonthAbbr(date: Date): string {
  return monthsAbbr[date.getMonth()];
};

export function getMonthName(date: Date): string {
  return monthsFull[date.getMonth()];
};

export function clearTime(dt: Date): Date {
  var dt = new Date(dt.getTime());
  dt.setHours(0);
  dt.setMinutes(0);
  dt.setSeconds(0);
  dt.setMilliseconds(0);
  return dt;
};

export function today(): Date {
  return clearTime(new Date());
};

function _toFormat(date: Date, format: string, replaceMap: Map<string, string>): string {
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

  for (let [k, v] of replaceMap) {
    replace(k, v);
  }

  s = '';
  for (i = 0, l = f.length; i < l; i++)
    s += typeof f[i] == 'string' ? f[i] : f[i][0];
  return f.join('');
};

export function toFormatUTC(date: Date, format: string): string {
  return _toFormat(date, format, getUTCReplaceMap(date));
}

export function toFormat(date: Date, format: string): string {
  return _toFormat(date, format, getReplaceMap(date));
}

var getReplaceMap = function (date: Date): Map<string, string> {
  let hours = (date.getHours() % 12) ? date.getHours() % 12 : 12;
  let m = new Map<string, string>()
  m.set('YYYY', date.getFullYear().toString());
  m.set('yyyy', date.getFullYear().toString());
  m.set('MMMM', monthsFull[date.getMonth()]);
  m.set('MMM', monthsAbbr[date.getMonth()]);
  m.set('MM', pad((date.getMonth() + 1).toString(), 2));
  m.set('MI', pad(date.getMinutes().toString(), 2));
  m.set('M', (date.getMonth() + 1).toString());
  m.set('DDDD', daysFull[date.getDay()]);
  m.set('DDD', daysAbbr[date.getDay()]);
  m.set('DD', pad(date.getDate().toString(), 2));
  m.set('dd', pad(date.getDate().toString(), 2));
  m.set('D', date.getDate().toString());
  m.set('HH', pad(date.getHours().toString(), 2));
  m.set('hh', pad(hours.toString(), 2));
  m.set('H', hours.toString());
  m.set('SS', pad(date.getSeconds().toString(), 2));
  m.set('PP', (date.getHours() >= 12) ? 'PM' : 'AM');
  m.set('P', (date.getHours() >= 12) ? 'pm' : 'am');
  m.set('LL', pad(date.getMilliseconds().toString(), 3));
  return m;
};

var getUTCReplaceMap = function (date: Date): Map<string, string> {
  let hours = (date.getUTCHours() % 12) ? date.getUTCHours() % 12 : 12;
  let m = new Map<string, string>()
  m.set('YYYY', date.getUTCFullYear().toString());
  m.set('yyyy', date.getUTCFullYear().toString());
  m.set('MMMM', monthsFull[date.getUTCMonth()]);
  m.set('MMM', monthsAbbr[date.getUTCMonth()]);
  m.set('MM', pad((date.getUTCMonth() + 1).toString(), 2));
  m.set('MI', pad(date.getUTCMinutes().toString(), 2));
  m.set('M', (date.getUTCMonth() + 1).toString());
  m.set('DDDD', daysFull[date.getUTCDay()]);
  m.set('DDD', daysAbbr[date.getUTCDay()]);
  m.set('DD', pad(date.getUTCDate().toString(), 2));
  m.set('dd', pad(date.getUTCDate().toString(), 2));
  m.set('D', date.getUTCDate().toString());
  m.set('HH', pad(date.getUTCHours().toString(), 2));
  m.set('hh', pad(hours.toString(), 2));
  m.set('H', hours.toString());
  m.set('SS', pad(date.getUTCSeconds().toString(), 2));
  m.set('PP', (date.getUTCHours() >= 12) ? 'PM' : 'AM');
  m.set('P', (date.getUTCHours() >= 12) ? 'pm' : 'am');
  m.set('LL', pad(date.getUTCMilliseconds().toString(), 3));
  return m;
};

export function pauseableTimer(strt? : Date) {
    let pstrt = new Date();
    strt = strt || pstrt;
    let rslt: any = {started: strt, paused: 0, pauseStarted: pstrt};

    rslt.pause = function() {
        if (!rslt.isPaused()) rslt.pauseStarted = new Date();
    };

    rslt.unPause = function() {
        if (rslt.isPaused()) {
            let diff = TimeSpan.FromDates( rslt.pauseStarted, new Date() ).totalMilliseconds();
            rslt.paused += diff;
            rslt.pauseStarted = null;
        }
    };

    rslt.start = rslt.unPause;

    rslt.isPaused = function() { 
        return rslt.pauseStarted === null;
    };

    rslt.elapsed = function() {
        //console.log('elapsed called');
        let now = rslt.isPaused() ? rslt.pauseStarted : new Date();
        let msecs = TimeSpan.FromDates( rslt.started, now ).totalMilliseconds();
        return msecs - rslt.paused;
    };

    return rslt;

};
