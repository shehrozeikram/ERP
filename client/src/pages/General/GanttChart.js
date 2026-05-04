import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Button, ButtonGroup, Card, CardContent, Chip, Skeleton,
  Stack, Tooltip, Typography, Paper
} from '@mui/material';
import { ChevronLeft, ChevronRight, FiberManualRecord as DotIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip as ChartTooltip,
  ComposedChart
} from 'recharts';
import { getTasks } from '../../services/projectManagementService';

dayjs.extend(isBetween);
dayjs.extend(weekOfYear);

// ─── Layout constants ─────────────────────────────────────────────────────────
const LEFT_W = 260;        // task name column width (px)
const ROW_H = 36;          // row height (px)
const HEADER_H = 52;       // date header height (px)

// ─── Pixels-per-day for each zoom level ──────────────────────────────────────
const PX_PER_DAY = { day: 30, week: 9, month: 4 };

// ─── Status colour palette ────────────────────────────────────────────────────
const STATUS_COLORS = {
  'Not Started': { bar: '#90a4ae', progress: '#78909c' },
  'In Progress':  { bar: '#42a5f5', progress: '#1976d2' },
  'Completed':    { bar: '#66bb6a', progress: '#388e3c' },
  'On Hold':      { bar: '#ffa726', progress: '#e65100' },
  'Cancelled':    { bar: '#ef9a9a', progress: '#c62828' },
};
const PHASE_COLOR = '#455a64';
const TODAY_COLOR = '#e53935';
const MILESTONE_COLOR = '#7b1fa2';
const GRID_COLOR = '#e0e0e0';
const WEEKEND_COLOR = 'rgba(0,0,0,0.03)';
const PHASE_BG  = 'rgba(69,90,100,0.06)';
const CHART_COLORS = ['#1976d2', '#ef6c00', '#2e7d32', '#6a1b9a', '#00838f', '#d81b60', '#5d4037'];
const moneyCompact = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${Math.round(n)}`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toDay = (d) => dayjs(d).startOf('day');

/** Convert a date to an X pixel offset from chartStart. */
const dateToX = (date, chartStart, pxDay) =>
  Math.round(toDay(date).diff(toDay(chartStart), 'day') * pxDay);

/** Truncate long strings. */
const trunc = (str, n) => (str && str.length > n ? str.slice(0, n) + '…' : str || '');

// ─── Build flat row list from task tree ───────────────────────────────────────
const buildRows = (tree) => {
  const rows = [];
  (tree || []).forEach((phase) => {
    rows.push({ ...phase, _isPhase: true });
    (phase.children || []).forEach((task) => {
      rows.push({ ...task, _isPhase: false, _phaseId: phase._id });
      (task.children || []).forEach((sub) => {
        rows.push({ ...sub, _isPhase: false, _isSub: true, _phaseId: phase._id });
      });
    });
  });
  return rows;
};

// ─── Compute chart date range from rows + project ────────────────────────────
const computeRange = (rows, project) => {
  const dates = [];
  rows.forEach((r) => {
    if (r.plannedStartDate) dates.push(toDay(r.plannedStartDate));
    if (r.plannedEndDate)   dates.push(toDay(r.plannedEndDate));
    if (r.actualStartDate)  dates.push(toDay(r.actualStartDate));
    if (r.actualEndDate)    dates.push(toDay(r.actualEndDate));
  });
  (project?.milestones || []).forEach((m) => {
    if (m.plannedDate) dates.push(toDay(m.plannedDate));
    if (m.actualDate)  dates.push(toDay(m.actualDate));
  });
  if (project?.startDate)       dates.push(toDay(project.startDate));
  if (project?.expectedEndDate) dates.push(toDay(project.expectedEndDate));

  if (!dates.length) {
    // Fallback: show current quarter
    return { start: dayjs().startOf('month'), end: dayjs().add(3, 'month').endOf('month') };
  }

  const minD = dates.reduce((a, b) => (a.isBefore(b) ? a : b));
  const maxD = dates.reduce((a, b) => (a.isAfter(b)  ? a : b));
  // Add 1-week padding on each side
  return {
    start: minD.subtract(7, 'day').startOf('day'),
    end:   maxD.add(14, 'day').endOf('day')
  };
};

// ─── Header cell generator (months / weeks / days) ───────────────────────────
const buildHeaderCells = (start, end, pxDay, zoom) => {
  const cells = [];
  let cur = toDay(start);
  const finish = toDay(end);

  if (zoom === 'month') {
    while (cur.isBefore(finish)) {
      const monthStart = cur.startOf('month').isBefore(start) ? start : cur.startOf('month');
      const monthEnd   = cur.endOf('month').isAfter(finish) ? finish : cur.endOf('month');
      const x     = dateToX(monthStart, start, pxDay);
      const width = Math.max(dateToX(monthEnd, start, pxDay) - x + pxDay, 1);
      cells.push({ label: cur.format('MMM YYYY'), x, width });
      cur = cur.add(1, 'month').startOf('month');
    }
  } else if (zoom === 'week') {
    // Top row: months; bottom row handled separately (weeks)
    while (cur.isBefore(finish)) {
      const wStart = cur.startOf('week');
      const wEnd   = cur.endOf('week');
      const x     = dateToX(wStart.isBefore(start) ? start : wStart, start, pxDay);
      const width = Math.max(dateToX(wEnd.isAfter(finish) ? finish : wEnd, start, pxDay) - x + pxDay, 1);
      cells.push({ label: `W${cur.week()} ${cur.format('DD MMM')}`, x, width });
      cur = cur.add(1, 'week').startOf('week');
    }
  } else { // day
    while (cur.isBefore(finish)) {
      const x = dateToX(cur, start, pxDay);
      cells.push({ label: cur.format('DD'), x, width: pxDay, isWeekend: cur.day() === 0 || cur.day() === 6 });
      cur = cur.add(1, 'day');
    }
  }
  return cells;
};

// ─── Month sub-labels for week zoom ──────────────────────────────────────────
const buildMonthBands = (start, end, pxDay) => {
  const bands = [];
  let cur = toDay(start).startOf('month');
  const finish = toDay(end);
  while (cur.isBefore(finish)) {
    const ms = cur.isBefore(start) ? start : cur;
    const me = cur.endOf('month').isAfter(finish) ? finish : cur.endOf('month');
    const x     = dateToX(ms, start, pxDay);
    const width = Math.max(dateToX(me, start, pxDay) - x + pxDay, 1);
    bands.push({ label: cur.format('MMMM YYYY'), x, width });
    cur = cur.add(1, 'month').startOf('month');
  }
  return bands;
};

// ─── Weekend columns for day zoom ────────────────────────────────────────────
const buildWeekendRects = (start, end, pxDay) => {
  const rects = [];
  let cur = toDay(start);
  const finish = toDay(end);
  while (cur.isBefore(finish)) {
    if (cur.day() === 0 || cur.day() === 6) {
      rects.push({ x: dateToX(cur, start, pxDay), width: pxDay });
    }
    cur = cur.add(1, 'day');
  }
  return rects;
};

// ─── Monthly grid lines ───────────────────────────────────────────────────────
const buildGridLines = (start, end, pxDay, zoom) => {
  const lines = [];
  let cur = toDay(start);
  const finish = toDay(end);
  const step = zoom === 'day' ? 'day' : zoom === 'week' ? 'week' : 'month';
  while (cur.isBefore(finish)) {
    lines.push(dateToX(cur, start, pxDay));
    cur = cur.add(1, step);
  }
  return lines;
};

// ─── Main component ───────────────────────────────────────────────────────────
const GanttChart = ({ project }) => {
  const [zoom, setZoom] = useState('month');
  const [taskData, setTaskData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const containerRef = useRef(null);
  const timelineRef  = useRef(null);
  const leftRef      = useRef(null);
  const [svgWidth, setSvgWidth] = useState(800);

  const pxDay = PX_PER_DAY[zoom];

  // ── Load tasks ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!project?._id) return;
    try {
      setLoading(true);
      const res = await getTasks(project._id);
      setTaskData(res.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [project?._id]);

  useEffect(() => { load(); }, [load]);

  // ── Measure container ────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        const w = entries[0]?.contentRect.width;
        if (w) setSvgWidth(Math.max(w - LEFT_W, 400));
      });
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Sync vertical scroll between left panel and timeline ────────────────────
  const handleTimelineScroll = (e) => {
    if (leftRef.current) leftRef.current.scrollTop = e.target.scrollTop;
  };
  const handleLeftScroll = (e) => {
    if (timelineRef.current) timelineRef.current.scrollTop = e.target.scrollTop;
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const rows    = useMemo(() => taskData ? buildRows(taskData.tree) : [], [taskData]);
  const range   = useMemo(() => computeRange(rows, project), [rows, project]);
  const totalDays  = toDay(range.end).diff(toDay(range.start), 'day') + 1;
  const chartWidth = Math.max(totalDays * pxDay, svgWidth);

  const headerCells  = useMemo(() => buildHeaderCells(range.start, range.end, pxDay, zoom), [range, pxDay, zoom]);
  const monthBands   = useMemo(() => zoom === 'week' ? buildMonthBands(range.start, range.end, pxDay) : [], [range, pxDay, zoom]);
  const weekendRects = useMemo(() => zoom === 'day'  ? buildWeekendRects(range.start, range.end, pxDay) : [], [range, pxDay, zoom]);
  const gridLines    = useMemo(() => buildGridLines(range.start, range.end, pxDay, zoom), [range, pxDay, zoom]);
  const todayX       = useMemo(() => dateToX(dayjs(), range.start, pxDay), [range.start, pxDay]);

  // Milestones
  const milestones = useMemo(() =>
    (project?.milestones || [])
      .filter(m => m.plannedDate)
      .map(m => ({
        ...m,
        x: dateToX(m.plannedDate, range.start, pxDay)
      })),
    [project, range.start, pxDay]
  );

  const taskOnlyRows = useMemo(() => rows.filter((r) => !r._isPhase), [rows]);

  const statusPieData = useMemo(() => {
    const counts = taskOnlyRows.reduce((acc, row) => {
      const key = row.status || 'Not Started';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [taskOnlyRows]);

  const phaseProgressData = useMemo(() => {
    const phaseMap = {};
    taskOnlyRows.forEach((row) => {
      const phaseKey = row._phaseId || 'misc';
      if (!phaseMap[phaseKey]) {
        const phaseName = (taskData?.tree || []).find((p) => p._id === phaseKey)?.title || 'General';
        phaseMap[phaseKey] = { name: phaseName, total: 0, progressSum: 0 };
      }
      phaseMap[phaseKey].total += 1;
      phaseMap[phaseKey].progressSum += Number(row.progressPercent || 0);
    });
    return Object.values(phaseMap).map((p) => ({
      name: trunc(p.name, 16),
      progress: p.total ? Math.round(p.progressSum / p.total) : 0
    }));
  }, [taskData?.tree, taskOnlyRows]);

  const phaseBudgetData = useMemo(() => {
    const phaseMap = {};
    taskOnlyRows.forEach((row) => {
      const phaseKey = row._phaseId || 'misc';
      if (!phaseMap[phaseKey]) {
        const phaseName = (taskData?.tree || []).find((p) => p._id === phaseKey)?.title || 'General';
        phaseMap[phaseKey] = { name: phaseName, budget: 0, actual: 0 };
      }
      const taskBudget =
        Number(row.estimatedCost || row.budget || row.plannedCost || row.estimatedAmount || 0);
      const taskActual =
        Number(row.actualCost || row.spent || row.actualAmount || 0);
      phaseMap[phaseKey].budget += Number.isFinite(taskBudget) ? taskBudget : 0;
      phaseMap[phaseKey].actual += Number.isFinite(taskActual) ? taskActual : 0;
    });

    const rowsOut = Object.values(phaseMap)
      .map((r) => ({ ...r, name: trunc(r.name, 14) }))
      .filter((r) => r.budget > 0 || r.actual > 0);

    if (rowsOut.length) return rowsOut;

    return [{
      name: 'Project Total',
      budget: Number(project?.totalApprovedBudget || project?.totalEstimatedCost || 0),
      actual: Number(project?.totalActualSpent || 0)
    }];
  }, [project?.totalActualSpent, project?.totalApprovedBudget, project?.totalEstimatedCost, taskData?.tree, taskOnlyRows]);

  const budgetKpi = useMemo(() => {
    const totalBudget = phaseBudgetData.reduce((sum, r) => sum + Number(r.budget || 0), 0);
    const totalActual = phaseBudgetData.reduce((sum, r) => sum + Number(r.actual || 0), 0);
    const pct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;
    return {
      totalBudget,
      totalActual,
      usedPct: Math.max(0, Math.min(pct, 999)),
      remaining: Math.max(0, totalBudget - totalActual)
    };
  }, [phaseBudgetData]);

  // Auto-scroll to today on mount / zoom change
  useEffect(() => {
    if (timelineRef.current && todayX > 0) {
      const visibleCenter = timelineRef.current.clientWidth / 2;
      timelineRef.current.scrollLeft = Math.max(0, todayX - visibleCenter);
    }
  }, [todayX, zoom]);

  // ── Zoom helpers ──────────────────────────────────────────────────────────────
  const scrollByMonths = (months) => {
    if (!timelineRef.current) return;
    timelineRef.current.scrollLeft += months * 30 * pxDay;
  };

  // ── Bar geometry for a row ─────────────────────────────────────────────────
  const getBar = (row) => {
    const s = row.actualStartDate || row.plannedStartDate;
    const e = row.actualEndDate   || row.plannedEndDate;
    if (!s && !e) return null;
    const startX = s ? dateToX(s, range.start, pxDay) : 0;
    const endX   = e ? dateToX(e, range.start, pxDay) + pxDay : startX + 30;
    const width  = Math.max(endX - startX, 6);
    const progressW = width * clamp((row.progressPercent || 0) / 100, 0, 1);
    return { x: startX, width, progressW };
  };

  // ── Row background colour ──────────────────────────────────────────────────
  const rowBg = (row, idx) =>
    row._isPhase ? PHASE_BG : idx % 2 === 0 ? '#fff' : '#fafafa';

  const totalH = HEADER_H + rows.length * ROW_H;

  if (loading) return <Skeleton height={400} />;
  if (error)   return <Box sx={{ color: 'error.main', py: 2 }}>{error}</Box>;
  if (!rows.length) {
    return (
      <Box textAlign="center" py={6}>
        <Typography color="text.secondary">
          No tasks or phases found. Add phases and tasks in the Tasks tab to see the Gantt chart.
        </Typography>
      </Box>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>

        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography variant="subtitle1" fontWeight={700}>Gantt Chart</Typography>
            <Chip label={`${rows.length} tasks`} size="small" />
          </Stack>

          <Stack direction="row" alignItems="center" gap={1}>
            {/* Navigation */}
            <Tooltip title="Scroll back">
              <Box component="button" onClick={() => scrollByMonths(-2)}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.5, cursor: 'pointer', bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
                <ChevronLeft fontSize="small" />
              </Box>
            </Tooltip>
            <Tooltip title="Scroll forward">
              <Box component="button" onClick={() => scrollByMonths(2)}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0.5, cursor: 'pointer', bgcolor: 'background.paper', display: 'flex', alignItems: 'center' }}>
                <ChevronRight fontSize="small" />
              </Box>
            </Tooltip>

            {/* Zoom */}
            <ButtonGroup size="small" variant="outlined">
              {[
                { key: 'month', label: 'Month' },
                { key: 'week',  label: 'Week'  },
                { key: 'day',   label: 'Day'   },
              ].map(({ key, label }) => (
                <Button
                  key={key}
                  variant={zoom === key ? 'contained' : 'outlined'}
                  onClick={() => setZoom(key)}
                >
                  {label}
                </Button>
              ))}
            </ButtonGroup>

            {/* Today button */}
            <Button
              size="small"
              variant="outlined"
              sx={{ borderColor: TODAY_COLOR, color: TODAY_COLOR }}
              onClick={() => {
                if (timelineRef.current) {
                  const visibleCenter = timelineRef.current.clientWidth / 2;
                  timelineRef.current.scrollLeft = Math.max(0, todayX - visibleCenter);
                }
              }}
            >
              Today
            </Button>
          </Stack>
        </Stack>

        {/* ── Legend ──────────────────────────────────────────────────── */}
        <Stack direction="row" gap={2} sx={{ px: 2, py: 1, flexWrap: 'wrap', borderBottom: '1px solid', borderColor: 'divider' }}>
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <Stack key={status} direction="row" alignItems="center" gap={0.5}>
              <Box sx={{ width: 14, height: 10, borderRadius: 1, bgcolor: colors.bar }} />
              <Typography variant="caption" color="text.secondary">{status}</Typography>
            </Stack>
          ))}
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Box sx={{ width: 2, height: 14, bgcolor: TODAY_COLOR, borderRadius: 1 }} />
            <Typography variant="caption" color="text.secondary">Today</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: MILESTONE_COLOR }} />
            <Typography variant="caption" color="text.secondary">Milestone</Typography>
          </Stack>
        </Stack>

        {/* ── Chart body ──────────────────────────────────────────────── */}
        <Box ref={containerRef} sx={{ display: 'flex', overflow: 'hidden' }}>

          {/* Left: task names */}
          <Box
            ref={leftRef}
            onScroll={handleLeftScroll}
            sx={{
              flexShrink: 0,
              width: LEFT_W,
              overflowY: 'hidden',
              overflowX: 'hidden',
              borderRight: '2px solid',
              borderColor: 'divider',
              userSelect: 'none',
            }}
          >
            {/* Corner */}
            <Box sx={{ height: HEADER_H, display: 'flex', alignItems: 'flex-end', pl: 2, pb: 1, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">TASK / PHASE</Typography>
            </Box>

            {/* Rows */}
            {rows.map((row, idx) => (
              <Box
                key={row._id || idx}
                sx={{
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  px: row._isPhase ? 1.5 : row._isSub ? 3.5 : 2.5,
                  bgcolor: rowBg(row, idx),
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  gap: 0.5,
                }}
              >
                {row._isPhase && (
                  <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: PHASE_COLOR, flexShrink: 0 }} />
                )}
                {!row._isPhase && !row._isSub && (
                  <DotIcon sx={{ fontSize: 8, color: 'grey.400', flexShrink: 0 }} />
                )}
                {row._isSub && (
                  <DotIcon sx={{ fontSize: 6, color: 'grey.300', ml: 1, flexShrink: 0 }} />
                )}
                <Tooltip title={row.title} placement="right">
                  <Typography
                    variant={row._isPhase ? 'body2' : 'caption'}
                    fontWeight={row._isPhase ? 700 : 400}
                    color={row._isPhase ? PHASE_COLOR : 'text.primary'}
                    noWrap
                    sx={{ flex: 1, minWidth: 0 }}
                  >
                    {trunc(row.title, row._isPhase ? 30 : 26)}
                  </Typography>
                </Tooltip>
                {row.progressPercent > 0 && !row._isPhase && (
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {row.progressPercent}%
                  </Typography>
                )}
              </Box>
            ))}
          </Box>

          {/* Right: timeline SVG */}
          <Box
            ref={timelineRef}
            onScroll={handleTimelineScroll}
            sx={{ flex: 1, overflowX: 'auto', overflowY: 'auto', maxHeight: 600, cursor: 'default' }}
          >
            <svg
              width={chartWidth}
              height={totalH}
              style={{ display: 'block', fontFamily: 'inherit' }}
            >
              {/* ── Weekend / grid backgrounds ─────────────────────── */}
              {weekendRects.map((r, i) => (
                <rect key={i} x={r.x} y={0} width={r.width} height={totalH} fill={WEEKEND_COLOR} />
              ))}

              {/* ── Vertical grid lines ────────────────────────────── */}
              {gridLines.map((x, i) => (
                <line key={i} x1={x} y1={HEADER_H} x2={x} y2={totalH}
                  stroke={GRID_COLOR} strokeWidth={0.8} />
              ))}

              {/* ── Header: month bands (week zoom top row) ─────────── */}
              {zoom === 'week' && monthBands.map((b, i) => (
                <g key={i}>
                  <rect x={b.x} y={0} width={b.width} height={HEADER_H / 2}
                    fill={i % 2 === 0 ? '#f5f5f5' : '#eeeeee'} />
                  <text x={b.x + 6} y={HEADER_H / 2 - 6} fontSize={11} fill="#555" fontWeight={600}>
                    {b.label}
                  </text>
                  <line x1={b.x} y1={0} x2={b.x} y2={HEADER_H / 2} stroke={GRID_COLOR} strokeWidth={1} />
                </g>
              ))}

              {/* ── Header: primary cells (months / weeks / days) ────── */}
              <rect x={0} y={zoom === 'week' ? HEADER_H / 2 : 0} width={chartWidth} height={zoom === 'week' ? HEADER_H / 2 : HEADER_H} fill="#f9f9f9" />
              {headerCells.map((cell, i) => {
                const yOff = zoom === 'week' ? HEADER_H / 2 : 0;
                const cellH = zoom === 'week' ? HEADER_H / 2 : HEADER_H;
                return (
                  <g key={i}>
                    {cell.isWeekend && (
                      <rect x={cell.x} y={yOff} width={cell.width} height={cellH} fill="rgba(0,0,0,0.04)" />
                    )}
                    <text
                      x={cell.x + (zoom === 'day' ? cell.width / 2 : 6)}
                      y={yOff + cellH - 8}
                      fontSize={zoom === 'month' ? 12 : zoom === 'week' ? 10 : 9}
                      fill={cell.isWeekend ? '#aaa' : '#444'}
                      fontWeight={zoom === 'month' ? 600 : 400}
                      textAnchor={zoom === 'day' ? 'middle' : 'start'}
                    >
                      {cell.label}
                    </text>
                    <line x1={cell.x} y1={yOff} x2={cell.x} y2={yOff + cellH} stroke={GRID_COLOR} strokeWidth={1} />
                  </g>
                );
              })}

              {/* Header bottom border */}
              <line x1={0} y1={HEADER_H} x2={chartWidth} y2={HEADER_H} stroke="#bdbdbd" strokeWidth={1.5} />

              {/* ── Row backgrounds ────────────────────────────────── */}
              {rows.map((row, idx) => (
                <rect
                  key={`bg-${row._id || idx}`}
                  x={0}
                  y={HEADER_H + idx * ROW_H}
                  width={chartWidth}
                  height={ROW_H}
                  fill={row._isPhase ? PHASE_BG : idx % 2 === 0 ? '#fff' : '#fafafa'}
                />
              ))}

              {/* ── Row bottom borders ─────────────────────────────── */}
              {rows.map((_, idx) => (
                <line
                  key={`hr-${idx}`}
                  x1={0} y1={HEADER_H + (idx + 1) * ROW_H}
                  x2={chartWidth} y2={HEADER_H + (idx + 1) * ROW_H}
                  stroke={GRID_COLOR} strokeWidth={0.8}
                />
              ))}

              {/* ── Task / Phase bars ──────────────────────────────── */}
              {rows.map((row, idx) => {
                const bar = getBar(row);
                if (!bar) return null;
                const y     = HEADER_H + idx * ROW_H;
                const barH  = row._isPhase ? 10 : row._isSub ? 14 : 18;
                const barY  = y + (ROW_H - barH) / 2;
                const colors = STATUS_COLORS[row.status] || STATUS_COLORS['Not Started'];
                const rx    = row._isPhase ? 2 : 4;

                if (row._isPhase) {
                  // Phase: chevron-style bar (thin bar + left/right triangles)
                  return (
                    <g key={row._id || idx}>
                      {/* Phase bar */}
                      <rect
                        x={bar.x} y={barY}
                        width={bar.width} height={barH}
                        fill={PHASE_COLOR} rx={rx}
                        opacity={0.85}
                      />
                      {/* Progress fill */}
                      {bar.progressW > 0 && (
                        <rect
                          x={bar.x} y={barY}
                          width={bar.progressW} height={barH}
                          fill="#263238" rx={rx}
                          opacity={0.9}
                        />
                      )}
                      {/* Label */}
                      {bar.width > 40 && (
                        <text
                          x={bar.x + 6} y={barY + barH / 2 + 4}
                          fontSize={9} fill="#fff" fontWeight={700}
                        >
                          {trunc(row.title, Math.floor(bar.width / 7))}
                        </text>
                      )}
                    </g>
                  );
                }

                return (
                  <g key={row._id || idx}>
                    {/* Background bar (empty) */}
                    <rect
                      x={bar.x} y={barY}
                      width={bar.width} height={barH}
                      fill={colors.bar} rx={rx}
                      opacity={0.8}
                    />
                    {/* Progress fill */}
                    {bar.progressW > 0 && (
                      <rect
                        x={bar.x} y={barY}
                        width={bar.progressW} height={barH}
                        fill={colors.progress} rx={rx}
                        opacity={0.95}
                      />
                    )}
                    {/* Percentage label inside bar */}
                    {bar.width > 30 && (
                      <text
                        x={bar.x + bar.width / 2} y={barY + barH / 2 + 4}
                        fontSize={9} fill="#fff"
                        fontWeight={500} textAnchor="middle"
                      >
                        {row.progressPercent > 0 ? `${row.progressPercent}%` : ''}
                      </text>
                    )}
                    {/* Planned vs actual: thin line for planned end if actual overruns */}
                    {row.actualEndDate && row.plannedEndDate &&
                      dayjs(row.actualEndDate).isAfter(dayjs(row.plannedEndDate)) && (
                      <line
                        x1={dateToX(row.plannedEndDate, range.start, pxDay)}
                        y1={barY - 2}
                        x2={dateToX(row.plannedEndDate, range.start, pxDay)}
                        y2={barY + barH + 2}
                        stroke="#e53935" strokeWidth={2} strokeDasharray="3,2"
                      />
                    )}
                  </g>
                );
              })}

              {/* ── Milestone diamonds ─────────────────────────────── */}
              {milestones.map((ms, i) => {
                // Find if any row y overlaps (place diamond on first matching phase if possible)
                const size = 8;
                // Draw at the bottom of the chart as a legend strip
                return (
                  <g key={i}>
                    {/* Vertical line down the chart */}
                    <line
                      x1={ms.x} y1={HEADER_H}
                      x2={ms.x} y2={HEADER_H + rows.length * ROW_H}
                      stroke={MILESTONE_COLOR} strokeWidth={1}
                      strokeDasharray="4,3" opacity={0.6}
                    />
                    {/* Diamond on the header bar */}
                    <polygon
                      points={`${ms.x},${HEADER_H - 14} ${ms.x + size},${HEADER_H - 8} ${ms.x},${HEADER_H - 2} ${ms.x - size},${HEADER_H - 8}`}
                      fill={MILESTONE_COLOR}
                      opacity={0.9}
                    />
                    {/* Label */}
                    <text
                      x={ms.x + 10} y={HEADER_H - 4}
                      fontSize={9} fill={MILESTONE_COLOR} fontWeight={600}
                    >
                      {trunc(ms.title, 20)}
                    </text>
                  </g>
                );
              })}

              {/* ── Today line ─────────────────────────────────────── */}
              {todayX >= 0 && todayX <= chartWidth && (
                <g>
                  <line
                    x1={todayX} y1={0}
                    x2={todayX} y2={totalH}
                    stroke={TODAY_COLOR} strokeWidth={1.5}
                  />
                  <rect
                    x={todayX - 18} y={0}
                    width={36} height={16}
                    fill={TODAY_COLOR} rx={3}
                  />
                  <text
                    x={todayX} y={12}
                    fontSize={9} fill="#fff"
                    fontWeight={700} textAnchor="middle"
                  >
                    Today
                  </text>
                </g>
              )}

            </svg>
          </Box>
        </Box>

        {/* ── Summary strip ───────────────────────────────────────────── */}
        <Stack
          direction="row"
          gap={3}
          sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}
        >
          <Typography variant="caption" color="text.secondary">
            <strong>Range:</strong> {toDay(range.start).format('DD MMM YYYY')} → {toDay(range.end).format('DD MMM YYYY')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <strong>Phases:</strong> {rows.filter(r => r._isPhase).length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <strong>Tasks:</strong> {rows.filter(r => !r._isPhase).length}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            <strong>Milestones:</strong> {milestones.length}
          </Typography>
          {project?.expectedEndDate && (
            <Typography variant="caption"
              color={dayjs(project.expectedEndDate).isBefore(dayjs()) ? 'error.main' : 'success.main'}
            >
              <strong>Project deadline:</strong> {dayjs(project.expectedEndDate).format('DD MMM YYYY')}
              {dayjs(project.expectedEndDate).isBefore(dayjs())
                ? ` (${dayjs().diff(dayjs(project.expectedEndDate), 'day')}d overdue)`
                : ` (${dayjs(project.expectedEndDate).diff(dayjs(), 'day')}d remaining)`}
            </Typography>
          )}
        </Stack>

        {/* ── Graphical charts ─────────────────────────────────────────── */}
        <Stack direction={{ xs: 'column', lg: 'row' }} gap={2} sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Card
            variant="outlined"
            sx={{
              flex: 1,
              borderRadius: 2,
              background: 'linear-gradient(180deg, rgba(25,118,210,0.06) 0%, rgba(25,118,210,0.01) 100%)'
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Task Status Distribution
              </Typography>
              {statusPieData.length ? (
                <Box sx={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={35}
                        paddingAngle={4}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine
                      >
                        {statusPieData.map((entry, idx) => (
                          <Cell key={`status-pie-${entry.name}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend />
                      <ChartTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No task data for pie chart yet.</Typography>
              )}
            </CardContent>
          </Card>

          <Card
            variant="outlined"
            sx={{
              flex: 1,
              borderRadius: 2,
              background: 'linear-gradient(180deg, rgba(67,160,71,0.06) 0%, rgba(67,160,71,0.01) 100%)'
            }}
          >
            <CardContent>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                Phase Progress (%)
              </Typography>
              {phaseProgressData.length ? (
                <Box sx={{ width: '100%', height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={phaseProgressData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={52} />
                      <YAxis domain={[0, 100]} />
                      <ChartTooltip />
                      <Bar dataKey="progress" radius={[6, 6, 0, 0]} fill="#1976d2" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No phase progress data yet.</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>

        <Box sx={{ px: 2, pb: 2 }}>
          <Card
            variant="outlined"
            sx={{
              borderRadius: 2,
              background: 'linear-gradient(180deg, rgba(255,152,0,0.08) 0%, rgba(255,152,0,0.01) 100%)'
            }}
          >
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" fontWeight={700}>
                  Budget vs Actual by Phase
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Currency: PKR
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', lg: 'row' }} gap={2}>
                {phaseBudgetData.length ? (
                  <Box sx={{ flex: 1, minWidth: 0, height: 300 }}>
                    <ResponsiveContainer>
                      <ComposedChart data={phaseBudgetData} margin={{ top: 8, right: 12, left: -10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={moneyCompact} />
                        <ChartTooltip
                          formatter={(value, key) => [
                            `PKR ${Number(value || 0).toLocaleString('en-PK')}`,
                            key === 'budget' ? 'Budget' : 'Actual'
                          ]}
                        />
                        <Legend />
                        <Bar dataKey="budget" name="Budget" fill="#42a5f5" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="actual" name="Actual" fill="#fb8c00" radius={[8, 8, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">No budget data available yet.</Typography>
                )}

                <Paper
                  variant="outlined"
                  sx={{
                    width: { xs: '100%', lg: 280 },
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.75)'
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Budget Utilization KPI
                  </Typography>
                  <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Used', value: Math.max(0, budgetKpi.usedPct) },
                            { name: 'Remaining', value: Math.max(0, 100 - Math.min(100, budgetKpi.usedPct)) }
                          ]}
                          dataKey="value"
                          innerRadius={54}
                          outerRadius={74}
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
                        >
                          <Cell fill="#fb8c00" />
                          <Cell fill="#e3f2fd" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'column',
                        pointerEvents: 'none'
                      }}
                    >
                      <Typography variant="h5" fontWeight={800} color={budgetKpi.usedPct > 100 ? 'error.main' : 'text.primary'}>
                        {budgetKpi.usedPct}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Utilized
                      </Typography>
                    </Box>
                  </Box>
                  <Stack spacing={0.4}>
                    <Typography variant="body2"><strong>Budget:</strong> PKR {Number(budgetKpi.totalBudget || 0).toLocaleString('en-PK')}</Typography>
                    <Typography variant="body2"><strong>Spent:</strong> PKR {Number(budgetKpi.totalActual || 0).toLocaleString('en-PK')}</Typography>
                    <Typography variant="body2"><strong>Remaining:</strong> PKR {Number(budgetKpi.remaining || 0).toLocaleString('en-PK')}</Typography>
                  </Stack>
                </Paper>
              </Stack>
            </CardContent>
          </Card>
        </Box>

      </CardContent>
    </Card>
  );
};

export default GanttChart;
