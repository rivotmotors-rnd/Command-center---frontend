import { useEffect, useState } from "react";
import { CustomDateTimePicker } from "../RealTimeChart";
import {
  BatteryCharging,
  Binary,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cpu,
  FileWarning,
  Layers,
  LoaderCircle,
  Search,
  SearchX,
  Sheet,
  X,
} from "lucide-react";

const FOUR_HOURS = 4 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------
 * Controller error decoding
 * `controller_errors` is a 6 character hex string = exactly 3 bytes
 * (Byte0, Byte1, Byte2). Every byte is converted to 8 binary digits and
 * reversed INDIVIDUALLY. The reversed byte is then read LEFT -> RIGHT, so
 * index 0 = Bit0 and index 7 = Bit7. Only bits equal to "1" are errors.
 * `null` = no name provided, so a generic label is used instead of
 * inventing a technical error name.
 * ---------------------------------------------------------------------- */
const CONTROLLER_ERROR_MAP = {
  0: [
    "Motor phase failure",
    "Under voltage fault",
    "Over voltage fault",
    "Motor stall",
    "0x5: Throttle control",
    "0xA: Torque control",
    "0xC: Speed control",
    null,
  ],
  1: [
    "Phase current overflowr Directive 61",
    "Phase current zero point fault",
    "Phase short circuit fault",
    "Line current zero point fault",
    "MOSFET upper bridge failure",
    "MOSFET low side fault",
    "Peak line current protection",
    "Brake failure",
  ],
  2: [
    "Motor Hall Fault",
    "Accelerator pedal failure",
    "Current protection restart",
    "Phase current overcurrent",
    "Voltage Fault",
    "Anti-theft alarm signal",
    "Motor overheating",
    "Controller over temperature",
  ],
};

const CONTROLLER_ERROR_BYTES = 3;

/* -------------------------------------------------------------------------
 * BMS error decoding (separate from the controller decoder above).
 * Same 8 byte / reverse-each-byte / left-to-right Bit0..Bit7 algorithm,
 * but driven by BMS_ERROR_MAP. `null` entries are Reserved bits and are
 * never displayed. Byte7 is a fault code, not a bit field.
 * ---------------------------------------------------------------------- */
const BMS_ERROR_MAP = {
  0: [
    "Cell voltage high level 1",
    "Cell voltage high level 2",
    "Cell voltage low level 1",
    "Cell voltage low level 2",
    "Sum voltage high level 1",
    "Sum voltage high level 2",
    "Sum voltage low level 1",
    "Sum voltage low level 2",
  ],
  1: [
    "charging temperatuer high level 1",
    "charging temperatuer high level 2",
    "charging temperatuer low level 1",
    "charging temperatuer low level 2",
    "Discharging temperatuer high level 1",
    "Discharging temperatuer high level 2",
    "Discharging temperatuer low level 1",
    "Discharging temperatuer low level 2",
  ],
  2: [
    "Charging overcurrent level 1",
    "Charging overcurrent level 2",
    "Discharging overcurrent level 1",
    "Discharging overcurrent level 2",
    "SOC high level 1",
    "SOC high level 2",
    "SOC Low level 1",
    "SOC Low level 2",
  ],
  3: [
    "Difference voltage level 1",
    "Difference voltage level 2", 
    "Difference temperatuer level 1",
    "difference temperatuer level 2",
    null,
    null,
    null,
    null,
  ],
  4: [
    "Charging Mosfet temperatuer high alarm",
    "Discharging Mosfet temperatuer high alarm",
    "Charging Mosfet temperatuer sensor error",
    "Discharging Mosfet temperatuer sensor error",
    "Charging Mosfet adhesion error",
    "Discharging Mosfet adhesion error",
    "Charging Mosfet open circuit error",
    "Discrg Mosfet open circuit error",
  ],
  5: [
    "AFE collect chip error",
    "Voltage collect dropped",
    "Cell temperatuer sensor error",
    "EEPROM error",
    "RTC error",
    "Precharge failure",
    "Communication failure",
    "Internal communication failure",
  ],
  6: [
    "Current module fault",
    "Sum voltage detect fault",
    "Short circuit protect fault",
    "Low Voltage for bidden charging fault",
    null,
    null,
    null,
    null,
  ],
  7: "Fault code",
};

const isValidControllerErrorHex = (value) =>
  typeof value === "string" &&
  /^[0-9a-fA-F]{6}$/.test(value.trim());

const isValidBmsErrorHex = (value) =>
  typeof value === "string" && /^[0-9a-fA-F]{16}$/.test(value.trim());

const decodeBmsErrors = (bmsErrors) => {
  if (!isValidBmsErrorHex(bmsErrors)) {
    return { hasErrors: false, invalid: true, errors: [] };
  }

  const hex = bmsErrors.trim().toUpperCase();
  const errors = [];

  for (let byteIndex = 0; byteIndex < 8; byteIndex++) {
    const byteHex = hex.slice(byteIndex * 2, byteIndex * 2 + 2);
    const byteValue = parseInt(byteHex, 16);

    const binary = byteValue.toString(2).padStart(8, "0");
    const reversedBinary = binary.split("").reverse().join("");

    // Byte7 is a fault code, not a bit field - never invent bit names.
    if (byteIndex === 7) {
      if (byteValue !== 0) {
        errors.push({
          byte: 7,
          bit: null,
          name: BMS_ERROR_MAP[7],
          hex: byteHex,
          binary,
          reversedBinary,
        });
      }
      continue;
    }

    const byteMap = BMS_ERROR_MAP[byteIndex];

    for (let bit = 0; bit < 8; bit++) {
      if (reversedBinary[bit] !== "1") continue;
      const name = byteMap[bit];
      if (!name) continue; // Reserved bit
      errors.push({
        byte: byteIndex,
        bit,
        name,
        hex: byteHex,
        binary,
        reversedBinary,
      });
    }
  }

  return { hasErrors: errors.length > 0, invalid: false, errors };
};

const decodeControllerErrors = (controllerError) => {
  if (!isValidControllerErrorHex(controllerError)) {
    return { hasErrors: false, invalid: true, errors: [] };
  }

  const hex = controllerError.trim().toUpperCase();
  const errors = [];

  for (let byteIndex = 0; byteIndex < CONTROLLER_ERROR_BYTES; byteIndex++) {
    const byteHex = hex.slice(byteIndex * 2, byteIndex * 2 + 2);
    const byteValue = parseInt(byteHex, 16);

    const binary = byteValue.toString(2).padStart(8, "0");
    const reversedBinary = binary.split("").reverse().join("");
    const byteMap = CONTROLLER_ERROR_MAP[byteIndex];

    for (let bit = 0; bit < 8; bit++) {
      if (reversedBinary[bit] !== "1") continue;

      // Byte0 Bit7 has no name provided - use a safe generic label.
      const name = byteMap[bit] || `Unknown Controller Error (Byte${byteIndex} Bit${bit})`;

      errors.push({
        byte: byteIndex,
        bit,
        name,
        hex: byteHex,
        binary,
        reversedBinary,
      });
    }
  }

  return { hasErrors: errors.length > 0, invalid: false, errors };
};

const pad2 = (n) => String(n).padStart(2, "0");

const formatDateTimeLocal = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;

const getCurrentDateTimeLocal = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const toUTC = (date) => {
  const d = new Date(date);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
};

function enforceFourHourWindow(start, end, editedSide) {
  if (isNaN(start) || isNaN(end)) return { start, end };

  let diff = end - start;

  if (diff <= 0) {
    if (editedSide === "start") {
      end = new Date(start.getTime() + FOUR_HOURS);
    } else {
      start = new Date(end.getTime() - FOUR_HOURS);
    }
    return { start, end };
  }

  if (diff > FOUR_HOURS) {
    if (editedSide === "start") {
      end = new Date(start.getTime() + FOUR_HOURS);
    } else {
      start = new Date(end.getTime() - FOUR_HOURS);
    }
    return { start, end };
  }

  return { start, end };
}

const parseTimeToDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value);
  const hasTz = /(Z|[+-]\d{2}:\d{2})$/.test(str);
  const hasT = str.includes("T");
  const iso = hasT ? str : str.replace(" ", "T") + (hasTz ? "" : "Z");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};

const formatTimeCell = (value) => {
  const d = parseTimeToDate(value);
  if (!d) return "N/A";
  return d
    .toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
    .replace(",", "");
};

const splitLogTimestamp = (value) => {
  const formatted = formatTimeCell(value);
  if (formatted === "N/A") return { date: "N/A", time: "" };
  const firstSpace = formatted.indexOf(" ");
  if (firstSpace === -1) return { date: formatted, time: "" };
  return {
    date: formatted.slice(0, firstSpace),
    time: formatted.slice(firstSpace + 1),
  };
};

const CONTROLLER_ZERO_VALUE = "000000";
const BMS_ZERO_VALUE = "0000000000000000";

const isZeroErrorValue = (value, zeroValue) => {
  if (typeof value !== "string") return true;
  const normalized = value.trim().toUpperCase();
  return normalized === "" || normalized === zeroValue;
};

const hasControllerErrorValue = (value) =>
  !isZeroErrorValue(value, CONTROLLER_ZERO_VALUE);

const hasBmsErrorValue = (value) => !isZeroErrorValue(value, BMS_ZERO_VALUE);

const PER_PAGE = 50;

const buildPageItems = (page, pageCount) => {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const items = [1];
  if (page > 3) items.push("...");
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  for (let p = from; p <= to; p++) items.push(p);
  if (page < pageCount - 2) items.push("...");
  items.push(pageCount);
  return items;
};

const DATE_MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DateTimeField = ({ value, onOpen }) => {
  const d = new Date(value);
  let text = "--";
  if (!isNaN(d.getTime())) {
    const h = d.getHours();
    const h12 = h % 12 === 0 ? 12 : h % 12;
    text = `${pad2(d.getDate())} ${DATE_MONTH_SHORT[d.getMonth()]} ${d.getFullYear()} · ${pad2(h12)}:${pad2(d.getMinutes())} ${h >= 12 ? "PM" : "AM"}`;
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      title={text}
      className="flex w-full cursor-pointer items-center gap-2 rounded-xl border border-[#FF9913]/30 bg-black px-3 py-2 text-left text-gray-300 transition hover:border-[#FF9913]/60 focus:outline-none focus:border-[#FF9913]/90"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4 shrink-0 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
      <span className="min-w-0 whitespace-nowrap text-sm font-medium">
        {text}
      </span>
    </button>
  );
};

export default function ErrorosLog({ vin }) {
  const [pickerTarget, setPickerTarget] = useState(null);
  const [startDateTime, setStartDateTime] = useState(() =>
    getCurrentDateTimeLocal(new Date(Date.now() - FOUR_HOURS))
  );
  const [endDateTime, setEndDateTime] = useState(() =>
    getCurrentDateTimeLocal(new Date())
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [applied, setApplied] = useState(null);
  const [activeCard, setActiveCard] = useState("total");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    setApplied(null);
    setRows([]);
    setHasFetched(false);
    setError(false);
    setPage(1);
    setSelectedRow(null);
    setActiveCard("total");
  }, [vin]);

  const handleLoad = () => {
    const trimmedVin = vin?.trim();
    if (!trimmedVin || !startDateTime || !endDateTime || loading) return;
    setApplied({ vin: trimmedVin, start: startDateTime, end: endDateTime });
  };

  useEffect(() => {
    if (!applied) return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    const url = `https://cc.rivotmotors.com/telemetry/errors?vin=${encodeURIComponent(
      applied.vin
    )}&start=${encodeURIComponent(toUTC(applied.start))}&end=${encodeURIComponent(
      toUTC(applied.end)
    )}`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setRows(Array.isArray(json?.data) ? json.data : []);
        setHasFetched(true);
        setPage(1);
        setSelectedRow(null);
        setActiveCard("total");
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applied]);

  const handleStartChange = (value) => {
    const newStart = new Date(value);
    if (isNaN(newStart)) return;

    const currentEnd = endDateTime
      ? new Date(endDateTime)
      : new Date(newStart.getTime() + FOUR_HOURS);
    const { start: fixedStart, end: fixedEnd } = enforceFourHourWindow(
      newStart,
      currentEnd,
      "start"
    );

    setStartDateTime(formatDateTimeLocal(fixedStart));
    setEndDateTime(formatDateTimeLocal(fixedEnd));
  };

  const handleEndChange = (value) => {
    const newEnd = new Date(value);
    if (isNaN(newEnd)) return;

    const currentStart = startDateTime
      ? new Date(startDateTime)
      : new Date(newEnd.getTime() - FOUR_HOURS);
    const { start: fixedStart, end: fixedEnd } = enforceFourHourWindow(
      currentStart,
      newEnd,
      "end"
    );

    setStartDateTime(formatDateTimeLocal(fixedStart));
    setEndDateTime(formatDateTimeLocal(fixedEnd));
  };

  const visibleRows = rows.filter(
    (row) =>
      hasControllerErrorValue(row.controller_errors) ||
      hasBmsErrorValue(row.bms_errors)
  );

  const controllerRows = visibleRows.filter((row) =>
    hasControllerErrorValue(row.controller_errors)
  );
  const bmsRows = visibleRows.filter((row) =>
    hasBmsErrorValue(row.bms_errors)
  );

  const controllerCount = controllerRows.length;
  const bmsCount = bmsRows.length;
  const totalCount = controllerCount + bmsCount;

  const filteredRows =
    activeCard === "controller"
      ? controllerRows
      : activeCard === "bms"
      ? bmsRows
      : visibleRows;

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const startIndex = (safePage - 1) * PER_PAGE;
  const pageRows = filteredRows.slice(startIndex, startIndex + PER_PAGE);
  const rangeStart = filteredRows.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = Math.min(startIndex + PER_PAGE, filteredRows.length);

  const showControllerCol = activeCard !== "bms";
  const showBmsCol = activeCard !== "controller";

  const handleRetry = () => {
    if (!applied) return;
    setApplied({ ...applied });
  };

  const selectCard = (card) => {
    setActiveCard(card);
    setPage(1);
    setSelectedRow(null);
  };

  useEffect(() => {
    if (!selectedRow) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSelectedRow(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedRow]);

  const summaryCards = [
    { key: "total", label: "Total Errors", count: totalCount },
    { key: "controller", label: "Controller Errors", count: controllerCount },
    { key: "bms", label: "BMS Errors", count: bmsCount },
  ];

  return (
    <div className="mt-3 flex h-[calc(100vh-8.75rem)] flex-col px-4 sm:px-6 sm:h-[calc(100vh-7.25rem)]">
      {/* Top section — compact, stays on screen while records scroll */}
      <div className="shrink-0 space-y-2">
        {/* Page header */}
        <div>
          <h1 className="flex items-center gap-2.5 text-xl sm:text-2xl font-semibold text-white tracking-[-0.01em]">
            <FileWarning
              className="h-6 w-6 shrink-0 text-[#FF9913] drop-shadow-[0_0_8px_rgba(255,153,19,0.55)]"
              strokeWidth={2}
            />
            Error Logs
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">
            Controller and BMS diagnostic history
          </p>
        </div>

        {/* Compact Date & Time filter */}
        <div className="rounded-xl border border-[#FF9913]/[0.2] bg-[#0E0E0E] px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-gray-300">
              <CalendarClock className="h-4 w-4 text-[#FF9913]" />
              Date &amp; Time
            </span>
            <div className="w-56 sm:w-60">
              <DateTimeField
                value={startDateTime}
                onOpen={() => setPickerTarget("start")}
              />
            </div>
            <span className="hidden shrink-0 text-gray-500 sm:block">—</span>
            <div className="w-56 sm:w-60">
              <DateTimeField
                value={endDateTime}
                onOpen={() => setPickerTarget("end")}
              />
            </div>
            <button
              onClick={handleLoad}
              disabled={!vin?.trim() || loading}
              className={
                `flex h-[38px] items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold tracking-normal transition-all duration-200 ` +
                (!vin?.trim() || loading
                  ? "cursor-not-allowed bg-[#FF9913]/20 text-gray-500"
                  : "bg-[#FF9913] text-black hover:bg-[#ffaa33] hover:shadow-[0_0_14px_rgba(255,153,19,0.35)]")
              }
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" strokeWidth={2.25} />
              )}
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          {pickerTarget === "start" && (
            <CustomDateTimePicker
              label="Start"
              value={startDateTime}
              onApply={handleStartChange}
              onClose={() => setPickerTarget(null)}
            />
          )}
          {pickerTarget === "end" && (
            <CustomDateTimePicker
              label="End"
              value={endDateTime}
              onApply={handleEndChange}
              onClose={() => setPickerTarget(null)}
            />
          )}
        </div>

        {/* Summary cards — only shown after the first successful Load */}
        {hasFetched && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {summaryCards.map((card) => {
              const isActive = activeCard === card.key;
              const isBms = card.key === "bms";
              const CardIcon =
                card.key === "total"
                  ? Layers
                  : isBms
                  ? BatteryCharging
                  : Cpu;
              const cardStyle = isActive
                ? isBms
                  ? "border-cyan-400 bg-cyan-400/[0.08] ring-1 ring-cyan-400/30"
                  : "border-[#FF9913] bg-[#FF9913]/[0.08] ring-1 ring-[#FF9913]/30"
                : isBms
                ? "border-white/10 hover:border-cyan-400/50 hover:bg-cyan-400/[0.03]"
                : "border-white/10 hover:border-[#FF9913]/50 hover:bg-[#FF9913]/[0.03]";
              const chipStyle = isBms
                ? "bg-cyan-400/15 text-cyan-300"
                : "bg-[#FF9913]/15 text-[#FF9913]";
              const labelStyle = isActive
                ? isBms
                  ? "text-cyan-300"
                  : "text-[#FF9913]"
                : "text-gray-400";
              const valueStyle = isActive
                ? isBms
                  ? "text-cyan-300"
                  : "text-[#FF9913]"
                : "text-white";

              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => selectCard(card.key)}
                  className={`group flex flex-col justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 ${cardStyle}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${chipStyle} transition-transform duration-150 group-hover:scale-105`}
                    >
                      <CardIcon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span
                      className={`truncate text-[11px] font-medium uppercase tracking-wide ${labelStyle}`}
                    >
                      {card.label}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`text-xl font-semibold leading-none tabular-nums ${valueStyle}`}
                    >
                      {card.count}
                    </span>
                    {isActive && (
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-wider ${labelStyle}`}
                      >
                        Viewing
                      </span>
                    )}
                  </div>
                </button>
              );
          })}
        </div>
        )}
      </div>

      {/* Error records — independently scrollable, shown after Load */}
      {applied && (
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#FF9913]/[0.2] bg-[#0E0E0E]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#FF9913]/[0.15] px-3 py-2">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-200">
              <Sheet className="h-4 w-4 text-[#FF9913]" />
              Error Records
            </span>
            {hasFetched && !loading && !error && filteredRows.length > 0 && (
              <span className="rounded-full border border-[#FF9913]/20 bg-[#FF9913]/10 px-2 py-0.5 text-[11px] font-medium text-[#FF9913]">
                {filteredRows.length} record
                {filteredRows.length === 1 ? "" : "s"}
              </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="h-8 w-8 border-4 border-[#FF9913]/30 border-t-[#FF9913] rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400">
                Loading error logs...
              </span>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="text-base font-medium text-white">
                Unable to load error logs
              </div>
              <p className="max-w-sm text-xs leading-relaxed text-gray-400">
                Please check the selected time range and try again.
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 rounded-lg border border-[#FF9913]/40 px-4 py-1.5 text-xs font-medium text-[#FF9913] transition hover:bg-[#FF9913]/10"
              >
                Retry
              </button>
            </div>
          ) : hasFetched && filteredRows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <SearchX
                className="h-8 w-8 text-[#FF9913]/40"
                strokeWidth={1.5}
              />
                <div className="mt-2 text-base font-semibold text-white">
                No errors found
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-gray-400">
                No Controller or BMS errors were recorded for the selected date
                and time range.
              </p>
            </div>
          ) : (
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-[#141414]">
                <tr>
                  <th className="px-3 py-2.5 text-left text-[13px] font-semibold tracking-normal text-gray-200 border-b border-white/10">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-500" />
                      Time
                    </span>
                  </th>
                  <th className="px-3 py-2.5 text-left text-[13px] font-semibold tracking-normal text-gray-200 border-b border-white/10">
                    <span className="flex items-center gap-1.5">
                      <Binary className="h-3.5 w-3.5 text-gray-500" />
                      Error Frame
                    </span>
                  </th>
                  {showControllerCol && (
                    <th className="px-3 py-2.5 text-left text-[13px] font-semibold tracking-normal text-gray-200 border-b border-white/10">
                      <span className="flex items-center gap-1.5">
                        <Cpu className="h-3.5 w-3.5 text-[#FF9913]" />
                        Controller
                      </span>
                    </th>
                  )}
                  {showBmsCol && (
                    <th className="px-3 py-2.5 text-left text-[13px] font-semibold tracking-normal text-gray-200 border-b border-white/10">
                      <span className="flex items-center gap-1.5">
                        <BatteryCharging className="h-3.5 w-3.5 text-cyan-400" />
                        BMS
                      </span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => {
                  const rawControllerError = row.controller_errors;
                  const ctrlDecoded = decodeControllerErrors(rawControllerError);
                  const showController =
                    hasControllerErrorValue(rawControllerError);
                  const rawBmsError = row.bms_errors;
                  const bmsDecoded = decodeBmsErrors(rawBmsError);
                  const showBms = hasBmsErrorValue(rawBmsError);
                  const { date: logDate, time: logTime } = splitLogTimestamp(
                    row.timestamp
                  );
                  const isSelected = selectedRow === row;

                  return (
                    <tr
                      key={index}
                      onClick={() => setSelectedRow(row)}
                      className={`cursor-pointer border-t border-white/5 transition-colors duration-100 ${
                        isSelected
                          ? "bg-[#FF9913]/[0.08]"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <td className="px-3 py-2 whitespace-nowrap align-top">
                        <div className="text-[13px] font-medium text-gray-100">
                          {logTime || "N/A"}
                        </div>
                        <div className="text-[12px] text-gray-300">
                          {logDate}
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {activeCard === "controller" ? (
                          showController ? (
                            <span className="font-mono text-xs text-[#FF9913]/90">
                              {rawControllerError}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )
                        ) : activeCard === "bms" ? (
                          showBms ? (
                            <span className="font-mono text-xs text-cyan-300/90">
                              {rawBmsError}
                            </span>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )
                        ) : showController || showBms ? (
                          <div className="space-y-1">
                            {showController && (
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF9913]" />
                                <span className="font-mono text-xs text-[#FF9913]/80">
                                  {rawControllerError}
                                </span>
                              </div>
                            )}
                            {showBms && (
                              <div className="flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                                <span className="font-mono text-xs text-cyan-300/80">
                                  {rawBmsError}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      {showControllerCol && (
                        <td className="px-3 py-2 align-top">
                          {showController ? (
                            ctrlDecoded.errors.length > 0 ? (
                              <span className="flex items-start gap-1.5">
                                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-[#FF9913]" />
                                <span className="text-[13px] leading-snug text-gray-100 break-words">
                                  {ctrlDecoded.errors[0].name}
                                  {ctrlDecoded.errors.length > 1 && (
                                    <span className="text-gray-400">
                                      {" "}
                                      +{ctrlDecoded.errors.length - 1} more
                                    </span>
                                  )}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                No Controller Error Data
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      )}
                      {showBmsCol && (
                        <td className="px-3 py-2 align-top">
                          {showBms ? (
                            bmsDecoded.errors.length > 0 ? (
                              <span className="flex items-start gap-1.5">
                                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-cyan-400" />
                                <span className="text-[13px] leading-snug text-gray-100 break-words">
                                  {bmsDecoded.errors[0].name}
                                  {bmsDecoded.errors.length > 1 && (
                                    <span className="text-gray-400">
                                      {" "}
                                      +{bmsDecoded.errors.length - 1} more
                                    </span>
                                  )}
                                </span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">
                                No BMS Error Data
                              </span>
                            )
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {hasFetched && !loading && !error && filteredRows.length > 0 && (
          <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-[#FF9913]/[0.15] px-3 py-2 sm:flex-row">
            <span className="text-xs text-gray-400">
              Showing {rangeStart}–{rangeEnd} of {filteredRows.length} errors
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-gray-300 transition hover:border-[#FF9913]/40 hover:text-[#FF9913] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {buildPageItems(safePage, pageCount).map((item, i) =>
                item === "..." ? (
                  <span
                    key={`e${i}`}
                    className="flex h-8 w-8 items-center justify-center text-xs text-gray-400"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-sm transition ${
                      item === safePage
                        ? "bg-[#FF9913] text-black"
                        : "border border-white/10 text-gray-300 hover:border-[#FF9913]/40 hover:text-[#FF9913]"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-gray-300 transition hover:border-[#FF9913]/40 hover:text-[#FF9913] disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        </div>
      )}

      {/* Detail drawer */}
      {selectedRow && (
        <div className="fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSelectedRow(null)}
            aria-hidden="true"
          />
          <aside
            className="absolute right-0 bottom-0 top-[7.5rem] flex w-full flex-col overflow-hidden border-l border-[#FF9913]/30 bg-[#0A0A0A] sm:top-[5.5rem] sm:w-[380px]"
            role="dialog"
            aria-label="Error details"
          >
            <div className="flex items-center justify-between border-b border-[#FF9913]/[0.15] bg-[#141414] px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-white">
                <FileWarning className="h-4 w-4 text-[#FF9913]" />
                Error Details
              </span>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                aria-label="Close details"
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-white/5 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const rawControllerError = selectedRow.controller_errors;
                const ctrlDecoded =
                  decodeControllerErrors(rawControllerError);
                const showController =
                  activeCard !== "bms" &&
                  hasControllerErrorValue(rawControllerError);
                const rawBmsError = selectedRow.bms_errors;
                const bmsDecoded = decodeBmsErrors(rawBmsError);
                const showBms =
                  activeCard !== "controller" &&
                  hasBmsErrorValue(rawBmsError);
                const { date: logDate, time: logTime } = splitLogTimestamp(
                  selectedRow.timestamp
                );

                return (
                  <div className="space-y-4">
                    {/* Timestamp */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                        <Clock className="h-3.5 w-3.5 text-gray-500" />
                        Timestamp
                      </div>
                      <div className="mt-0.5 font-mono text-sm text-white">
                        {logDate} {logTime}
                      </div>
                    </div>

                    {/* Controller */}
                    {showController && (
                      <div className="rounded-lg border border-[#FF9913]/[0.25] bg-[#FF9913]/[0.04] p-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-[#FF9913]">
                          <Cpu className="h-4 w-4" />
                          Controller Error
                        </div>
                        <div className="mt-1.5 font-mono text-xs text-gray-400">
                          Frame: {rawControllerError}
                        </div>
                        {ctrlDecoded.invalid ? (
                          <div className="mt-2 text-xs text-gray-400">
                            No Controller Error Data
                          </div>
                        ) : ctrlDecoded.errors.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {ctrlDecoded.errors.map((error, i) => (
                              <li
                                key={`${error.byte}-${error.bit}-${i}`}
                                className="border-t border-[#FF9913]/[0.12] pt-2"
                              >
                                <div className="text-[13px] leading-snug text-white break-words">
                                  {error.name}
                                </div>
                                <div className="mt-0.5 grid grid-cols-2 gap-1 font-mono text-[11px] text-gray-400">
                                  <span>Byte {error.byte}</span>
                                  <span>
                                    {error.bit === null
                                      ? "Fault code"
                                      : `Bit ${error.bit}`}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-2 text-xs text-gray-400">
                            No Controller Error Data
                          </div>
                        )}
                      </div>
                    )}

                    {/* BMS */}
                    {showBms && (
                      <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/[0.04] p-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-cyan-300">
                          <BatteryCharging className="h-4 w-4" />
                          BMS Error
                        </div>
                        <div className="mt-1.5 font-mono text-xs text-gray-400">
                          Frame: {rawBmsError}
                        </div>
                        {bmsDecoded.invalid ? (
                          <div className="mt-2 text-xs text-gray-400">
                            No BMS Error Data
                          </div>
                        ) : bmsDecoded.errors.length > 0 ? (
                          <ul className="mt-2 space-y-2">
                            {bmsDecoded.errors.map((error, i) => (
                              <li
                                key={`${error.byte}-${error.bit}-${i}`}
                                className="border-t border-cyan-400/[0.12] pt-2"
                              >
                                <div className="text-[13px] leading-snug text-white break-words">
                                  {error.name}
                                </div>
                                <div className="mt-0.5 grid grid-cols-2 gap-1 font-mono text-[11px] text-gray-400">
                                  <span>Byte {error.byte}</span>
                                  <span>
                                    {error.bit === null
                                      ? "Fault code"
                                      : `Bit ${error.bit}`}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-2 text-xs text-gray-400">
                            No BMS Error Data
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}