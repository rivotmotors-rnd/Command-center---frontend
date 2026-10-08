import React, { useEffect, useState, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Check, X, RefreshCw } from "lucide-react";
const savedTableState = {};

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

// Parse it as UTC and render it in the browser's local time zone so the
// column matches the vehicle owner's clock.

const formatTimeCell = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const str = String(value);
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(str);
  const hasT = str.includes("T");
  const iso = hasT ? str : str.replace(" ", "T") + (hasTz ? "" : "Z");
  const d = new Date(iso);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

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

export default function Tabledata({ vin }) {
  const saved = useRef(savedTableState[vin] || null);
  const [loading, setLoading] = useState(saved.current ? false : true);
  const [allvin, setAllvin] = useState(saved.current ? saved.current.allvin : null);
  const [realtimeData, setRealtimeData] = useState(saved.current ? saved.current.realtimeData : []);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(saved.current ? saved.current.page : 0);
  const [start, setStart] = useState(saved.current ? saved.current.start : "");
  const [end, setEnd] = useState(saved.current ? saved.current.end : "");
  const [draftStart, setDraftStart] = useState(saved.current ? saved.current.draftStart : "");
  const [draftEnd, setDraftEnd] = useState(saved.current ? saved.current.draftEnd : "");
  const [columns, setColumns] = useState(saved.current ? saved.current.columns : []); // all column names
  const [selectedColumns, setSelectedColumns] = useState(saved.current ? saved.current.selectedColumns : ["time","speed_kmph"]); // selected columns
  const [showDropdown, setShowDropdown] = useState(false);
  const [pickerTarget, setPickerTarget] = useState(null); // null | 'start' | 'end'
  const [isOnLast, setIsOnLast] = useState(saved.current ? saved.current.isOnLast : false);

  const dropdownRef = useRef(null);
  const hasMountedRef = useRef(false);
  const loadedOnceRef = useRef(false);
  const prevVinRef = useRef(vin);
  const limit = 500;

  const allVinLabels = {
  vinnumber: "VIN",
  model: "Vehicle model",
  ownername: "Owner name",
  phonenumber: "Phone number",
  controllerid: "Controller ID",
  motorid: "Motor ID",
  bmsid: "BMS ID",
  chargerid: "Charger ID",
  rideosversion: "rideOS Version",
  smartkeyid: "comfortKey ID",
  odo: "Odometer (km)",
  chargingstate: "Charging status",
  handlelockstate: "Handle lock status",
  seatlockstate: "Seat lock status",
  bmsmosstates: "BMS mosfet status",
  riders: "Current rider",
  bmslifecycles: "BMS life cycles",
  lat_long: "Location ",
  time: "Last updated",
  serialnum: "Serial number"
};

const realtimeLabels = {
  speed_kmph: "Speed (km/h)",
  tripkm: "Trip(km)",
  controllermostemp: "Controller mosfet temperature",
  motortemp: "Motor temperature",
  bmsmostemp: "BMS mosfet temperature",
  ntc: "NTC temperature",
  currentconsumption: "Current consumption",
  batvoltage: "Battery voltage (V)",
  remainingcapacity_ah: "Remaining capacity (Ah)",
  inah: "In ah",
  inah_by_charger: "In ah by charge",
  inah_by_regen: "In ah by regen",
  outah: "Out ah",
  ev_power_state: "EV power state",
  currentrider: "Current rider",
  tirepressure: "Tire pressure",
  soc: "SOC (%)",
  apusoc: "APU SOC (%)",
  lat_long: "Location",
  time: "Timestamp"
};

const handleSelectAll = () => {
  if (selectedColumns.length === columns.length) {
    // If already all selected → unselect all
    setSelectedColumns([]);
  } else {
    // Select all columns
    setSelectedColumns(columns);
  }
};

  const fetchData = async (currentPage = 0, s = start, e = end) => {
    if (!vin) return;
    setLoading(true);
    setError(null);

    try {
      const offset = currentPage * limit;
      let url = ` https://cc.rivotmotors.com/vehicles/${vin}?limit=${limit}&offset=${offset}`;
      if (s && e) {
        url += `&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

const scooter = data.all_scooters || {};
      const rows = Array.isArray(data.telemetry_history)
        ? data.telemetry_history
        : [];

      if (data.status === "success") {
        loadedOnceRef.current = true;
        setAllvin(scooter);
        setRealtimeData(rows);

        if (rows.length > 0) {
          const cols = Object.keys(rows[0]).filter((col) => col !== "vin");
          setColumns(cols);
          if (selectedColumns.length === 0) setSelectedColumns(cols);
        }
      } else {
        setError(scooter.message || data.message || "Failed to fetch data");
      }
    } catch (err) {
      console.error(err);
      setError("Error fetching data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  const handleClickOutside = (event) => {
    // If the dropdown is open AND the click target is outside the dropdown and button
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setShowDropdown(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);


useEffect(() => {
  if (!vin) return;
  if (!loadedOnceRef.current) return;
  savedTableState[vin] = {
    page,
    start,
    end,
    draftStart,
    draftEnd,
    isOnLast,
    realtimeData,
    allvin,
    columns,
    selectedColumns,
  };
}, [vin, page, start, end, draftStart, draftEnd, isOnLast, realtimeData, allvin, columns, selectedColumns]);


useEffect(() => {
  if (!vin) return;
  const snap = savedTableState[vin];
  if (prevVinRef.current !== vin) {
    prevVinRef.current = vin;
    if (snap) {
      setPage(snap.page);
      setIsOnLast(snap.isOnLast);
      setStart(snap.start);
      setEnd(snap.end);
      setDraftStart(snap.draftStart);
      setDraftEnd(snap.draftEnd);
      setAllvin(snap.allvin);
      setRealtimeData(snap.realtimeData);
      setColumns(snap.columns);
      setSelectedColumns(snap.selectedColumns);
    } else {
      setPage(0);
      setIsOnLast(false);
      setStart("");
      setEnd("");
      setDraftStart("");
      setDraftEnd("");
      fetchData(0);
    }
    return;
  }
  if (!snap) {
    setPage(0);
    fetchData(0);
  }

}, [vin]);


 useEffect(() => {
  return () => {
    hasMountedRef.current = false;
  };
 }, []);


 useEffect(() => {
  if (!hasMountedRef.current) {
    hasMountedRef.current = true;
    return;
  }
  if (!vin) return;
  fetchData(page);
}, [page]);


  const handleNext = () => {
    const nextPage = page + 1;
    setIsOnLast(false);
    setPage(nextPage);
    fetchData(nextPage);
  };

  const handlePrev = () => {
    if (page === 0) return;
    const prevPage = page - 1;
    setIsOnLast(false);
    setPage(prevPage);
    fetchData(prevPage);
  };

  const handleFilter = () => {
    setIsOnLast(false);
    setStart(draftStart);
    setEnd(draftEnd);
    setPage(0);
    fetchData(0, draftStart, draftEnd);
  };

  const handleRefresh = () => {
    setStart("");
    setEnd("");
    setDraftStart("");
    setDraftEnd("");
    setIsOnLast(false);
    setPage(0);
    fetchData(0, "", "");
  };

  // Lightweight probe: does the given page contain at least one row?
  const probeExists = async (targetPage) => {
    if (!vin) return false;
    const offset = targetPage * limit;
    let url = ` https://cc.rivotmotors.com/vehicles/${vin}?limit=1&offset=${offset}`;
    if (start && end) {
      url += `&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
   return (
      data.status === "success" &&
      Array.isArray(data.telemetry_history) &&
      data.telemetry_history.length > 0
    );
  };

  // Actually locate the LAST non-empty page (exponential probe + binary search)
  // then navigate to it through the existing [page] effect.
  const handleLast = async () => {
    if (!vin) return;
    setLoading(true);
    try {
      let low = 0;
      let high = 1;
      while (await probeExists(high)) {
        low = high;
        high *= 2;
      }
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (await probeExists(mid)) low = mid;
        else high = mid;
      }
      const lastPage = low;
      setIsOnLast(true);
      setPage(lastPage);
      fetchData(lastPage);
    } finally {
      setLoading(false);
    }
  };

  const handleFirst = () => {
    setIsOnLast(false);
    setPage(0);
  };

  const handleColumnSelect = (col) => {
    setSelectedColumns((prev) =>
      prev.includes(col)
        ? prev.filter((c) => c !== col)
        : [...prev, col]
    );
  };

 
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!vin) return <p className="text-orange-400">Please enter a VIN number.</p>;
  if (loading) return <p className="text-orange-400">Loading...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="px-5 py-4 w-full max-w-[95vw] mx-auto text-white  min-h-screen overflow-x-hidden">

      {allvin && (
        <div className="p-6 border border-[#FF9913]/40 bg-[#141414] rounded-2xl shadow-[0_0_20px_rgba(255,153,19,0.15)] transition-all hover:shadow-[0_0_25px_rgba(255,153,19,0.25)]">
          <h2 className="text-2xl font-Kanit mb-4 text-[#FF9913] tracking-wide">
            All scooters table
          </h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(allvin)
              .filter(([key]) => key !== "telemetry_history")
              .map(([key, value]) => (
              <p
                key={key}
                className="flex justify-between bg-[#1C1C1C] px-3 py-2 rounded-md border border-[#FF9913]/20"
              >
                <span className="text-[#FF9913] ">
                  {allVinLabels[key] || key}
                </span>

                <span
                  className="text-gray-300 max-w-[260px] truncate whitespace-nowrap overflow-hidden"
                  title={Array.isArray(value) ? value.join(", ") : value}
                >
                  {key === "rideosversion"
                    ? (Array.isArray(value) ? value.join(", ") : value).split(",").join(", ")
                    : key === "time"
                    ? formatTimeCell(value)
                    : Array.isArray(value)
                    ? value.join(", ")
                    : value ?? "-"}
                </span>
              </p>
            ))}
          </div>
        </div>
      )}
{/* ==== Filter & Controls Section (Redesigned Layout) setting up the main sourec  ==== */}
  
  <div className="flex flex-col gap-3 mt-4 mb-4 p-2">

    {/* === Date + Time + Filter (same line) === */}
    <div className="flex flex-wrap items-end gap-4">
      {/* Start Time */}
      <div>
        <label className="block text-[#FF9913] text-sm mb-1 font-Kanit">
          Start time
        </label>
        <CustomDateTimeField
          label="Start"
          value={draftStart}
          onOpen={() => setPickerTarget("start")}
        />
      </div>

      {/* End Time */}
      <div>
        <label className="block text-[#FF9913] text-sm mb-1 font-Kanit">
          End time
        </label>
        <CustomDateTimeField
          label="End"
          value={draftEnd}
          onOpen={() => setPickerTarget("end")}
        />
      </div>

      {/* Filter Button Beside Date Inputs */}
      <button
        type="button"
        onClick={handleFilter}
        className="bg-gradient-to-r from-[#FF9913] to-[#FFB347] text-black font-Kanit px-6 py-2.5 rounded-lg hover:scale-105 transition-transform shadow-md mt-[22px]"
      >
        Load
      </button>
    </div>

    {/* === Second Row: Select Columns + Pagination === */}
    <div className="flex flex-wrap items-center justify-between gap-4">
      {/* Left: Select Columns Button */}
    <div className="relative" ref={dropdownRef}>
    <button
      type="button"
      onClick={() => setShowDropdown((prev) => !prev)}
      className="flex items-center gap-2 bg-[#1C1C1C] text-[#FF9913] font-Kanit px-2 py-2 rounded-lg border border-[#FF9913]/40 hover:bg-[#2A2A2A] transition-all"
    >
      <span>Select columns</span>

      {/* Dropdown Arrow Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className={`w-4 h-4 transition-transform duration-300 ${
          showDropdown ? "rotate-180" : "rotate-0"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    {/* Dropdown Menu */}
    {showDropdown && (
      <div className="absolute mt-2 bg-[#141414] border border-[#FF9913]/50 rounded-xl shadow-[0_0_20px_rgba(255,153,19,0.2)] max-h-64 overflow-y-auto w-72 p-4 z-50">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#FF9913]/30">
    <label className="flex items-center gap-2 text-[#FF9913] font-Kanit cursor-pointer">
    <input
      type="checkbox"
      checked={selectedColumns.length === columns.length}
      onChange={handleSelectAll}
      className="accent-[#FF9913] scale-110"
    />
    Select All
  </label>
  </div>
        {columns.map((col) => (
          <label
            key={col}
            className="flex items-center gap-2 text-sm text-[#FFB347] py-1 hover:bg-[#1F1F1F] rounded px-2 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedColumns.includes(col)}
              onChange={() => handleColumnSelect(col)}
              className="accent-[#FF9913] scale-110"
            />
          {realtimeLabels[col] || col}
          </label>
        ))}
      </div>
    )}
  </div>

      {/* Right: Pagination Buttons beside Select Columns */}
    <div className="flex justify-end items-center gap-3">
    {/* === Refresh Button === */}
    <button
      type="button"
      onClick={handleRefresh}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-Kanit bg-[#1C1C1C] border border-[#FF9913]/40 hover:bg-[#2A2A2A] text-[#FF9913] transition-all"
    >
      <RefreshCw className="w-4 h-4" />
      <span>Refresh</span>
    </button>
  
    {page > 0 && (
    <button
      type="button"
      onClick={handleFirst}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-Kanit bg-[#1C1C1C] border border-[#FF9913]/40 hover:bg-[#2A2A2A] text-[#FF9913] transition-all"
    >
      
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
      </svg>
      <span>First</span>
    </button>
    )}

    {/* === Previous Button === */}
    <button
      type="button"
      onClick={handlePrev}
      disabled={page === 0}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-Kanit transition-all ${
        page === 0
          ? "bg-gray-700 cursor-not-allowed text-gray-400"
          : "bg-[#1C1C1C] border border-[#FF9913]/40 hover:bg-[#2A2A2A] text-[#FF9913]"
      }`}
    >
      {/* Left Arrow Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span>Previous</span>
    </button>

    {/* === Next Button === */}
    <button
      type="button"
      onClick={handleNext}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-Kanit bg-gradient-to-r from-[#FF9913] to-[#FFB347] text-black hover:scale-105 transition-transform shadow-md"
    >
      <span>Next</span>
      {/* Right Arrow Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>

    {/* === Last Button (only shown when a Date & Time range is actively loaded) === */}
    {start && end && !isOnLast && (
    <button
      type="button"
      onClick={handleLast}
      className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-Kanit bg-[#1C1C1C] border border-[#FF9913]/40 hover:bg-[#2A2A2A] text-[#FF9913] transition-all"
    >
      <span>Last</span>
      {/* Double Right Arrow Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l5 5-5 5M6 5l5 5-5 5" />
      </svg>
    </button>
    )}
  </div>
    </div>
  </div>
    {/* ==== Comfortable Modern Table ==== */}
  <div className="border border-[#FF9913]/20 rounded-2xl shadow-[0_0_20px_rgba(255,153,19,0.1)] bg-[#0E0E0E] max-h-[500px] overflow-y-auto">
    <h2 className="text-2xl p-4 font-Kanit  text-[#FF9913] tracking-wide">
            Historical table
      </h2>
  <table className="min-w-full border-collapse text-sm font-Kanit">
    <thead className="bg-[#1A1A1A] sticky top-0">
      <tr>
        {selectedColumns.map((col) => (
          <th
            key={col}
            className="px-5 py-3 text-left text-[#FF9913] font-Kanit text-sm  tracking-wide border-b border-[#FF9913]/20"
          >
            {realtimeLabels[col] || col}
          </th>
        ))}
      </tr>
    </thead>

    <tbody>
      {realtimeData.length === 0 ? (
        <tr>
          <td
            colSpan={selectedColumns.length}
            className="text-center py-10 text-gray-500"
          >
            No Data Available
          </td>
        </tr>
      ) : (
        realtimeData.map((row, index) => (
          <tr
            key={index}
            className={`transition-all duration-200 ${
              index % 2 === 0 ? "bg-[#121212]" : "bg-[#171717]"
            } hover:bg-[#202020]/80`}
          >
            {selectedColumns.map((key) => (
              <td
                key={key}
                className="px-5 py-3 text-gray-200 text-sm border-b border-[#FF9913]/10 whitespace-nowrap"
              >
                {Array.isArray(row[key])
                  ? row[key].join(", ")
                  : key === "time"
                  ? formatTimeCell(row[key])
                  : row[key] ?? "-"}
              </td>
            ))}
          </tr>
        ))
      )}
    </tbody>
    </table>
    </div>

      {/* Custom Date & Time picker modals */}
      {pickerTarget === "start" && (
        <CustomDateTimePicker
          label="Start"
          value={draftStart}
          onApply={(newStart) => {
            setDraftStart(newStart);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}
      {pickerTarget === "end" && (
        <CustomDateTimePicker
          label="End"
          value={draftEnd}
          onApply={(newEnd) => {
            setDraftEnd(newEnd);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  );
}
