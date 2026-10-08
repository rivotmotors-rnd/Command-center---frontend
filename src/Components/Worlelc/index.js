import React, { useState, useEffect, useRef } from "react";
import Wapelement from "../Wapelement";
import { Calendar, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import LiveTracker from "../LiveTracker";
import { motion, AnimatePresence } from "framer-motion";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ---------------------------------------------------------------------
// Custom Date + Time selector (same behavior/UI as the one in RealTimeChart)
// ---------------------------------------------------------------------
const pad2 = (n) => String(n).padStart(2, "0");
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK_DAYS = ["S","M","T","W","T","F","S"];
const HOUR_CLOCK = [12,1,2,3,4,5,6,7,8,9,10,11];
const MINUTE_CLOCK = ["00","05","10","15","20","25","30","35","40","45","50","55"];

function snapMinute(m) {
  const snapped = Math.round(m / 5) * 5;
  return snapped >= 60 ? 55 : snapped;
}

// Visual analog clock face used for both hour and minute selection.
// Supports precise tap and drag selection across all positions.
function ClockFace({ total, labels, selectedIndex, selectedLabel, onSelectIndex }) {
  const faceRef = useRef(null);
  const draggingRef = useRef(false);
  const r = 0.40;
  const PX = 210;

  const indexFromEvent = (e) => {
    const rect = faceRef.current.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const angleA = Math.atan2(dy, dx);
    let index = Math.round(((angleA + Math.PI / 2) / (Math.PI * 2)) * total);
    index = ((index % total) + total) % total;
    return index;
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    draggingRef.current = true;
    onSelectIndex(indexFromEvent(e));
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!draggingRef.current) return;
    onSelectIndex(indexFromEvent(e));
  };
  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  const selAngle = (selectedIndex / total) * 2 * Math.PI - Math.PI / 2;
  const cx = PX / 2;
  const cy = PX / 2;
  const endX = cx + r * PX * Math.cos(selAngle);
  const endY = cy + r * PX * Math.sin(selAngle);

  return (
    <div
      ref={faceRef}
      className="relative w-[min(46vw,210px)] sm:w-[min(62vw,210px)] h-[min(46vw,210px)] sm:h-[min(62vw,210px)] mx-auto select-none touch-none cursor-pointer"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="slider"
      aria-label="Clock"
      aria-valuenow={selectedIndex}
      aria-valuemin={0}
      aria-valuemax={total - 1}
      aria-valuetext={selectedLabel}
    >
      {/* outer circle */}
      <div className="absolute inset-0 rounded-full border border-white/15 bg-white/5 pointer-events-none" />
      {/* clock hand */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 210 210">
        <line x1={cx} y1={cy} x2={endX} y2={endY} stroke="#FF9913" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {/* center dot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 sm:w-2 sm:h-2 rounded-full bg-[#FF9913] pointer-events-none" />
      {/* visible guide labels */}
      {labels.map((lb) => {
        if (lb.index === selectedIndex) return null;
        const ang = (lb.index / total) * 2 * Math.PI - Math.PI / 2;
        return (
          <span
            key={lb.index}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-[11px] sm:text-sm font-semibold text-white pointer-events-none"
            style={{ left: `${50 + r * 100 * Math.cos(ang)}%`, top: `${50 + r * 100 * Math.sin(ang)}%` }}
          >
            {lb.text}
          </span>
        );
      })}
      {/* orange selected circle following the hand */}
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 sm:w-8 sm:h-8 rounded-full bg-[#FF9913] text-black text-[10px] sm:text-sm font-semibold shadow-[0_0_14px_rgba(255,153,19,0.65)] flex items-center justify-center pointer-events-none"
        style={{ left: `${50 + r * 100 * Math.cos(selAngle)}%`, top: `${50 + r * 100 * Math.sin(selAngle)}%` }}
      >
        {selectedLabel}
      </span>
    </div>
  );
}

// Individual clickable field (START / END) that opens the picker.
function CustomDateTimeField({ label, value, onOpen }) {
  const d = new Date(value);
  let displayDate = "--";
  let displayTime = "";
  if (!isNaN(d.getTime())) {
    const h = d.getHours();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const per = h >= 12 ? "PM" : "AM";
    displayDate = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
    displayTime = `${pad2(h12)}:${pad2(d.getMinutes())} ${per}`;
  }
  return (
    <div>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-xl border border-[#FF9913]/30 bg-black px-3 py-2 text-left text-white
                  hover:border-[#FF9913]/60 focus:outline-none focus:border-[#FF9913]/90
                  focus:shadow-[0_0_12px_2px_rgba(255,153,19,0.4)] transition cursor-pointer
                  flex items-center gap-3"
      >
        <Calendar className="w-4 h-4 text-white shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate">{displayDate ? `${displayDate} · ${displayTime}` : "--"}</span>
        </span>
      </button>
    </div>
  );
}

// The full custom picker (calendar + clock + AM/PM + actions). Value is in
// the same YYYY-MM-DDTHH:mm (local) format the app uses.
function CustomDateTimePicker({ label, value, onApply, onClose }) {
  const parseValue = () => {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      const now = new Date();
      const h = now.getHours();
      return {
        year: now.getFullYear(),
        month: now.getMonth(),
        date: now.getDate(),
        hour12: h % 12 === 0 ? 12 : h % 12,
        minute: snapMinute(now.getMinutes()),
        period: h >= 12 ? "PM" : "AM",
      };
    }
    const h = d.getHours();
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      date: d.getDate(),
      hour12: h % 12 === 0 ? 12 : h % 12,
      minute: snapMinute(d.getMinutes()),
      period: h >= 12 ? "PM" : "AM",
    };
  };

  const initial = parseValue();
  const [viewMonth, setViewMonth] = useState(() => new Date(initial.year, initial.month, 1));
  const [selYear, setSelYear] = useState(initial.year);
  const [selMonth, setSelMonth] = useState(initial.month);
  const [selDate, setSelDate] = useState(initial.date);
  const [selHour12, setSelHour12] = useState(initial.hour12);
  const [selMinute, setSelMinute] = useState(initial.minute);
  const [selPeriod, setSelPeriod] = useState(initial.period);
  const [timeMode, setTimeMode] = useState("hour");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const today = new Date();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, fromOther: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, fromOther: false });
  while (cells.length % 7 !== 0) cells.push({ day: nextDay(cells), fromOther: true });

  function nextDay() {
    return cells[cells.length - 1].fromOther ? cells[cells.length - 1].day + 1 : 1;
  }

  const goPrevMonth = () => setViewMonth(new Date(year, month - 1, 1));
  const goNextMonth = () => setViewMonth(new Date(year, month + 1, 1));

  const selectDate = (day, fromOther) => {
    let y = year, m = month;
    if (fromOther) {
      if (day > 15) { m = month - 1; } else { m = month + 1; }
      if (m < 0) { m = 11; y = year - 1; }
      if (m > 11) { m = 0; y = year + 1; }
    }
    setSelYear(y);
    setSelMonth(m);
    setSelDate(day);
    setViewMonth(new Date(y, m, 1));
  };

  const handleHour = (h) => {
    setSelHour12(h);
    setTimeMode("minute");
  };

  const handleHourIndex = (idx) => {
    handleHour(idx === 0 ? 12 : idx);
  };

  const handleDone = () => {
    const h24 = (selHour12 % 12) + (selPeriod === "PM" ? 12 : 0);
    const dateStr = `${selYear}-${pad2(selMonth + 1)}-${pad2(selDate)}T${pad2(h24)}:${pad2(selMinute)}`;
    onApply(dateStr);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} date and time`}
        className="relative w-full max-w-full sm:w-auto sm:max-w-2xl mx-2 sm:mx-0 bg-[#0A0A0A] border border-[#FF9913]/30 rounded-2xl sm:rounded-2xl shadow-[0_0_40px_rgba(255,153,19,0.25)] px-2.5 pb-2.5 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-5 max-h-[calc(100dvh-2rem)] sm:max-h-[92vh] flex flex-col sm:block overflow-hidden sm:overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 sm:mb-3 shrink-0">
          <h3 className="text-[11px] sm:text-base font-Kanit tracking-wider text-[#FF9913] break-words pr-2">
            {label} Date &amp; Time
          </h3>
          <button type="button" onClick={onClose} aria-label="Close picker"
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition shrink-0">
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Current selection */}
        <div className="flex flex-wrap items-center justify-between gap-1 sm:gap-2 mb-2 sm:mb-4 px-0.5 sm:px-1 shrink-0">
          <span className="text-sm sm:text-lg font-Kanit text-white">
            {selDate} {MONTH_SHORT[selMonth]} {selYear}
          </span>
          <span className="text-sm sm:text-lg font-Kanit text-[#ffffff] flex items-center">
            <button
              type="button"
              onClick={() => setTimeMode("hour")}
              aria-label="Select hour"
              className={`px-1 rounded transition ${timeMode === "hour" ? "bg-[#FF9913] text-black" : "hover:text-[#FF9913]"}`}
            >
              {selHour12}
            </button>
            <span>:</span>
            <button
              type="button"
              onClick={() => setTimeMode("minute")}
              aria-label="Select minute"
              className={`px-1 rounded transition ${timeMode === "minute" ? "bg-[#FF9913] text-black" : "hover:text-[#FF9913]"}`}
            >
              {pad2(selMinute)}
            </button>
            <span className="ml-1">{selPeriod}</span>
          </span>
        </div>

        {/* Calendar + Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0 overflow-y-auto py-0.5 sm:py-0 sm:flex-none sm:min-h-0 sm:overflow-visible">
          {/* Calendar */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <button type="button" onClick={goPrevMonth} aria-label="Previous month"
                className="text-[#FF9913] hover:bg-[#FF9913]/10 rounded-lg p-1 transition">
                <ChevronLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </button>
              <div className="text-[11px] sm:text-sm font-semibold text-white">
                {MONTH_FULL[month]} {year}
              </div>
              <button type="button" onClick={goNextMonth} aria-label="Next month"
                className="text-[#FF9913] hover:bg-[#FF9913]/10 rounded-lg p-1 transition">
                <ChevronRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center mb-1">
              {WEEK_DAYS.map((d, i) => (
                <div key={i} className="text-[9px] sm:text-[11px] text-gray-400">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {cells.map((c, i) => {
                const isSelected = !c.fromOther && c.day === selDate && month === selMonth && year === selYear;
                const isToday = !c.fromOther && c.day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDate(c.day, c.fromOther)}
                    aria-label={`${c.day} ${MONTH_FULL[month]} ${year}`}
                    className={`h-6 sm:h-9 w-full rounded-lg text-[11px] sm:text-sm transition flex items-center justify-center
                      ${c.fromOther ? "text-gray-600" : "text-white hover:bg-white/10"}
                      ${isSelected ? "bg-[#FF9913] text-black font-bold shadow-[0_0_12px_rgba(255,153,19,0.5)]" : ""}
                      ${isToday && !isSelected ? "ring-1 ring-[#FF9913]/60" : ""}`}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time */}
          <div className="w-full">
            <div className="mb-1.5 sm:mb-2 text-center text-[11px] sm:text-sm font-Kanit text-white">
              {timeMode === "hour" ? "Select Hour" : "Select Minute"}
            </div>
            {timeMode === "hour" ? (
              <ClockFace
                total={12}
                labels={HOUR_CLOCK.map((h, i) => ({ text: String(h), index: i }))}
                selectedIndex={selHour12 % 12}
                selectedLabel={String(selHour12)}
                onSelectIndex={handleHourIndex}
              />
            ) : (
              <ClockFace
                total={60}
                labels={MINUTE_CLOCK.map((m, i) => ({ text: m, index: i * 5 }))}
                selectedIndex={selMinute}
                selectedLabel={pad2(selMinute)}
                onSelectIndex={setSelMinute}
              />
            )}
            <div className="mt-2 sm:mt-3 flex justify-center gap-1.5 sm:gap-2">
              <button type="button" onClick={() => setSelPeriod("AM")}
                aria-pressed={selPeriod === "AM"}
                className={`px-2.5 py-0.5 sm:px-4 sm:py-1.5 rounded-lg text-[11px] sm:text-sm font-Kanit transition border ${
                  selPeriod === "AM"
                    ? "bg-[#FF9913] text-black border-[#FF9913] shadow-[0_0_12px_rgba(255,153,19,0.4)]"
                    : "text-white border-white/20 hover:border-[#FF9913]/60"}`}>
                AM
              </button>
              <button type="button" onClick={() => setSelPeriod("PM")}
                aria-pressed={selPeriod === "PM"}
                className={`px-2.5 py-0.5 sm:px-4 sm:py-1.5 rounded-lg text-[11px] sm:text-sm font-Kanit transition border ${
                  selPeriod === "PM"
                    ? "bg-[#FF9913] text-black border-[#FF9913] shadow-[0_0_12px_rgba(255,153,19,0.4)]"
                    : "text-white border-white/20 hover:border-[#FF9913]/60"}`}>
                PM
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-2.5 sm:mt-5 flex justify-end gap-2.5 sm:gap-3 shrink-0 pt-1">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-Kanit text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition">
            Cancel
          </button>
          <button type="button" onClick={handleDone}
            className="px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-Kanit text-black bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:scale-105 hover:shadow-[0_0_20px_rgba(245,166,35,0.6)] transition-all inline-flex items-center gap-1">
            <Check className="w-3 h-3 sm:w-4 sm:h-4" /> Done
          </button>
        </div>
        <div className="h-0 sm:hidden" style={{ height: "env(safe-area-inset-bottom)" }} />
      </div>
    </div>
  );
}

export default function Worlelc({ vin, liveData }) {
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [fetchParams, setFetchParams] = useState(null);
  const [activeTab, setActiveTab] = useState("live");
  const [loading, setLoading] = useState(false);
  const [autoMode, setAutoMode] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // null | 'start' | 'end'
  const [selectedOptions, setSelectedOptions] = useState([ "speed_kmph",
  "currentconsumption",
  "batvoltage",]);
  
  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  const ONE_MINUTE = 60 * 1000;
  const dropdownRef = useRef(null);
  const [liveSelectedOptions, setLiveSelectedOptions] = useState([
  "Speed (km/h)",
  "Battery voltage (V)"
]);


// ---------------------------------------------------------------------
// Helper: keep the selected window ≤ 4 hours and never allow a 0‑minute range
// ---------------------------------------------------------------------
const MAX_RANGE_MS = FOUR_HOURS;               // 4 h in ms

/** 
+ * Adjust start / end so that:
+ *   • diff ≤ 4 h
+ *   • diff > 0 (if diff === 0 we push the *other* side by +4 h)
+ *   • the side that the user just edited stays exactly what they typed
+ *   • the opposite side is moved only when needed
+ *
+ * @param {Date} start   – currently selected start (may be the edited value)
+ * @param {Date} end     – currently selected end   (may be the edited value)
+ * @param {'start'|'end'} editedSide – which picker the user just changed
+ * @returns {{start: Date, end: Date}} – corrected dates
+ */
function enforceFourHourWindow(start, end, editedSide) {
  // Ensure we have valid Date objects
  if (isNaN(start) || isNaN(end)) return { start, end };

  let diff = end - start; // ms (can be negative)

  // -----------------------------------------------------------------
  // 1️⃣  Zero‑minute range  → push the opposite side by exactly 4 h
  // -----------------------------------------------------------------
  if (diff === 0) {
    if (editedSide === 'start') {
      end = new Date(start.getTime() + MAX_RANGE_MS);
    } else {
      start = new Date(end.getTime() - MAX_RANGE_MS);
    }
    return { start, end };
  }

  // -----------------------------------------------------------------
  // 2️⃣  Range > 4 h  → move the *opposite* side so the window becomes 4 h
  // -----------------------------------------------------------------
  if (Math.abs(diff) > MAX_RANGE_MS) {
    if (editedSide === 'start') {
      // user changed start → keep start, move end forward
      end = new Date(start.getTime() + MAX_RANGE_MS);
    } else {
      // user changed end → keep end, move start backward
      start = new Date(end.getTime() - MAX_RANGE_MS);
    }
    return { start, end };
  }

  // -----------------------------------------------------------------
  // 3️⃣  Valid range (≤ 4 h, > 0) → do nothing
  // -----------------------------------------------------------------
  return { start, end };
}


 const liveOptionsList = [
  "Speed (km/h)",
  "Trip (km)",
  "Battery voltage (V)",
  "inah_by_charger",
  "inah_by_regen",
  "SOC (%)",
  "APU SOC",
  "Motor temp (°C)",
  "Controller mosfet temp (°C)",
  "BMS mosfet temp (°C)",
  "Inah (Ah)",
  "Outah (Ah)",
  "Remaining capacity (Ah)",
  "Current consumption (A)",
  "Rider Status",
  "Power State",
  "Current Gear",
  "Range",
  "Time",
  "Lat-long",
];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCheckboxChange = (option) => {
    setSelectedOptions((prev) =>
      prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option]
    );
  };

  const formatDateTimeLocal = (date) => {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };
  // ✅ Default Time = Last 3 Hours
  const setDefaultTimes = () => {
    const now = new Date();
    const past3 = new Date(now.getTime() - 3 * 60 * 60 * 1000); // <-- CHANGED
    setStartTime(formatDateTimeLocal(past3));
    setEndTime(formatDateTimeLocal(now));
    setAutoMode(true);
    setErrorMsg("");
  };

  useEffect(() => {
    setDefaultTimes();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (autoMode) setDefaultTimes();
    }, 60000);
    return () => clearInterval(timer);
  }, [autoMode]);

  useEffect(() => {
    setFetchParams(null);
  }, [vin]);

  const handleLoadHistory = () => {
  if (!startTime || !endTime) {
    return setErrorMsg("Please select both start and end times.");
  }

  const start = new Date(startTime);
  const end = new Date(endTime);

  const diff = end - start;

  if (diff <= 0) {
    return setErrorMsg("Invalid time range.");
  }

  if (diff > FOUR_HOURS) {
    return setErrorMsg("Maximum allowed range is 4 hours.");
  }
  setErrorMsg("");
  setFetchParams({ start: startTime, end: endTime });
  setActiveTab("history");
};

const handleStartChange = (value) => {
  // Stop auto-range while user edits
  setAutoMode(false);

  const newStart = new Date(value);
  if (isNaN(newStart)) return;

  // Keep the current end value; enforce 4-hour window immediately
  const currentEnd = endTime ? new Date(endTime) : new Date(newStart.getTime() + FOUR_HOURS);
  const { start: fixedStart, end: fixedEnd } = enforceFourHourWindow(newStart, currentEnd, 'start');

  setStartTime(formatDateTimeLocal(fixedStart));
  setEndTime(formatDateTimeLocal(fixedEnd));
};

const handleEndChange = (value) => {
  // Stop auto-range while user edits
  setAutoMode(false);

  const newEnd = new Date(value);
  if (isNaN(newEnd)) return;

  // Keep the current start value; enforce 4-hour window immediately
  const currentStart = startTime ? new Date(startTime) : new Date(newEnd.getTime() - FOUR_HOURS);
  const { start: fixedStart, end: fixedEnd } = enforceFourHourWindow(currentStart, newEnd, 'end');

  setStartTime(formatDateTimeLocal(fixedStart));
  setEndTime(formatDateTimeLocal(fixedEnd));
};

const ONE_MIN = 60 * 1000;

const isNow = (date) => {
  const now = new Date();
  return Math.abs(date - now) < ONE_MIN; // within 1 min
};

const clampToFourHours = (start, end, type) => {
  const diff = end.getTime() - start.getTime();

  if (diff <= 0) {
    if (type === "start") {
      return {
        start,
        end: new Date(start.getTime() + FOUR_HOURS),
      };
    } else {
      return {
        start: new Date(end.getTime() - FOUR_HOURS),
        end,
      };
    }
  }

  if (diff > FOUR_HOURS) {
    if (type === "start") {
      return {
        start,
        end: new Date(start.getTime() + FOUR_HOURS),
      };
    } else {
      return {
        start: new Date(end.getTime() - FOUR_HOURS),
        end,
      };
    }
  }
  return { start, end };
};

  return (
    <div className="w-full flex flex-col">
    <div className="flex items-center justify-between border-b border-[#FF9913]/30 pb-2">
  <div className="flex gap-2">
    <button
      onClick={() => { setActiveTab("live"); setShowDropdown(false); }}
      className={`px-4 py-2 rounded-lg text-sm font-Kanit ${
        activeTab === "live"
          ? "rounded-xl px-6 py-2.5 text-sm bg-green-500 text-black"
          : "rounded-xl px-6 py-2.5 text-sm bg-white/10 text-gray-300 hover:bg-white/20"
      }`}
      >
      Live
    </button>

    <button
      onClick={() => { setActiveTab("history"); setShowDropdown(false); }}
      className={`px-4 py-2 rounded-lg text-sm font-Kanit ${
        activeTab === "history"
          ? "rounded-xl px-6 py-2.5 text-sm font-Kanit text-black bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"
          : "rounded-xl px-6 py-2.5 text-sm bg-white/10 text-gray-300 hover:bg-white/20"
      }`}
    >
      History
    </button>
  </div>

   <div className=" mb-1 relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={`flex items-center gap-2 px-2 py-1 text-xs sm:text-sm md:text-base rounded-md border border-[#FF9913]/40 
                transition-all duration-300 
                ${
                  showDropdown
                    ? "bg-[#FF9913]/20 text-[#FF9913]"
                    : "bg-white/10 text-gray-300 hover:bg-white/20"
                } w-full sm:w-auto justify-between`}
            >
              <span>
              {activeTab === "live" ? "Live Parameters" : "History Parameters"}
              </span>
            <svg
                className={`w-3 h-3 transition-transform duration-300 ${
                  showDropdown ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 20 20"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="absolute z-[1000] mt-2 right-0 w-52 bg-[#111]/90 border border-[#FF9913]/30 rounded-lg shadow-lg p-3 overflow-auto max-h-80"
                >
                 {(activeTab === "live" ? liveOptionsList : [
                   "speed_kmph",
                  "tripkm",
                  "batvoltage",
                  "inah_by_charger",
                  "inah_by_regen",
                  "soc",
                  "apusoc",
                  "motortemp",
                  "controllermostemp",
                  "bmsmostemp",
                  "inah",
                  "outah",
                  "remainingcapacity_ah",
                  "currentconsumption",
                  "currentrider",
                  "ev_power_state",
                  "tirepressure",
                  "time",
                  "lat_long"
                ]).map((item) => {

                  const isLive = activeTab === "live";
                  const selected = isLive ? liveSelectedOptions : selectedOptions;

                  return (
                    <motion.label
                      key={item}
                      whileHover={{ scale: 1.02 }}
                      className="flex items-center gap-2 mb-2 text-gray-200 hover:text-[#FF9913] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(item)}
                        onChange={() => {
                          if (isLive) {
                            setLiveSelectedOptions((prev) =>
                              prev.includes(item)
                                ? prev.filter((i) => i !== item)
                                : [...prev, item]
                            );
                          } else {
                            handleCheckboxChange(item);
                          }
                        }}
                        className="accent-[#FF9913]"
                      />
                      {item}
                    </motion.label>
                  );
                })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
    </div>

      {/* Controls */}
      {activeTab === "history" && (
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-3">
        {/* Time Pickers */}
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          {/* Start Time */}
          <div className="relative w-full md:w-auto">
            <CustomDateTimeField label="Start" value={startTime} onOpen={() => setPickerTarget("start")} />
          </div>

          {/* End Time */}
          <div className="relative w-full md:w-auto">
            <CustomDateTimeField label="End" value={endTime} onOpen={() => setPickerTarget("end")} />
          </div>

          {/* Custom Date + Time picker */}
          {pickerTarget === "start" && (
            <CustomDateTimePicker
              label="Start"
              value={startTime}
              onApply={(val) => handleStartChange(val)}
              onClose={() => setPickerTarget(null)}
            />
          )}
          {pickerTarget === "end" && (
            <CustomDateTimePicker
              label="End"
              value={endTime}
              onApply={(val) => handleEndChange(val)}
              onClose={() => setPickerTarget(null)}
            />
          )}

          {activeTab === "history" && (
            <div className="flex gap-3 mt-2 md:mt-0">
              <button
                onClick={handleLoadHistory}
                disabled={loading}
                className="rounded-xl px-6 py-2.5 text-sm font-Kanit text-black bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"
              >
                {loading ? "Loading..." : "Load History"}
              </button>

              {!autoMode && (
                <button
                  onClick={setDefaultTimes}
                  className="rounded-xl px-6 py-2.5 text-sm font-Kanit text-black bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500"
                >
                  Set Default
                </button>
              )}
            </div>
          )}
        </div>  
      </div>
      )}

     {activeTab === "history" && errorMsg && (
  <div className="text-red-400 text-sm mt-1 font-medium">{errorMsg}</div>
  )}
      <div className="relative w-full" style={{ height: "calc(100vh - 155px)" }}>
        {vin ? (
          activeTab === "live" ? (
            <LiveTracker vin={vin} liveData={liveData} selectedOptions={liveSelectedOptions}/>
          ) : fetchParams ? (
            <Wapelement
              vin={vin}
              start={fetchParams.start}
              end={fetchParams.end}
              applyFilter={fetchParams}
              selectedOptions={selectedOptions}
            />
          ) : (
            <div className="text-[#FF9913] mt-2">
              Select start & end time and click <b>Load History</b>
            </div>
          )
        ) : (
          <div className="text-white mt-2">Please select VIN to load map...</div>
        )}
      </div>
    </div>
  );
}