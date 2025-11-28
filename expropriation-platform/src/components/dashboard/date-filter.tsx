'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarIcon,
  Clock,
  TrendingUp,
  Filter,
  X
} from 'lucide-react';
import { format, addDays, addMonths, addYears, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange as DayPickerDateRange } from 'react-day-picker';

interface DateRange {
  from: Date;
  to: Date;
}

interface DateFilterProps {
  onDateRangeChange: (range: DateRange | null) => void;
  onPeriodChange: (period: string) => void;
  className?: string;
}

const PREDEFINED_PERIODS = [
  { value: 'today', label: 'Hoy', getDateRange: () => {
    const today = new Date();
    return { from: startOfDay(today), to: endOfDay(today) };
  }},
  { value: 'yesterday', label: 'Ayer', getDateRange: () => {
    const yesterday = addDays(new Date(), -1);
    return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
  }},
  { value: 'last7days', label: 'Últimos 7 días', getDateRange: () => {
    const today = new Date();
    return { from: startOfDay(addDays(today, -7)), to: endOfDay(today) };
  }},
  { value: 'last30days', label: 'Últimos 30 días', getDateRange: () => {
    const today = new Date();
    return { from: startOfDay(addDays(today, -30)), to: endOfDay(today) };
  }},
  { value: 'thisMonth', label: 'Este mes', getDateRange: () => {
    const today = new Date();
    return { from: startOfMonth(today), to: endOfMonth(today) };
  }},
  { value: 'lastMonth', label: 'Mes pasado', getDateRange: () => {
    const today = new Date();
    const lastMonth = addMonths(today, -1);
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
  }},
  { value: 'thisQuarter', label: 'Este trimestre', getDateRange: () => {
    const today = new Date();
    const quarter = Math.floor(today.getMonth() / 3);
    const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
    const quarterEnd = new Date(today.getFullYear(), quarter * 3 + 3, 0);
    return { from: startOfDay(quarterStart), to: endOfDay(quarterEnd) };
  }},
  { value: 'thisYear', label: 'Este año', getDateRange: () => {
    const today = new Date();
    return { from: startOfYear(today), to: endOfYear(today) };
  }},
  { value: 'lastYear', label: 'Año pasado', getDateRange: () => {
    const today = new Date();
    const lastYear = addYears(today, -1);
    return { from: startOfYear(lastYear), to: endOfYear(lastYear) };
  }}
];

export function DateFilter({ onDateRangeChange, onPeriodChange, className }: DateFilterProps) {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('last30days');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    setCustomMode(false);

    if (period === 'custom') {
      setCustomMode(true);
      return;
    }

    const periodConfig = PREDEFINED_PERIODS.find(p => p.value === period);
    if (periodConfig) {
      const range = periodConfig.getDateRange();
      setDateRange(range);
      onDateRangeChange(range);
      onPeriodChange(period);
    }
  };

  const handleDateRangeSelect = (range: DayPickerDateRange | undefined) => {
    if (range?.from && range?.to) {
      const newRange = { from: startOfDay(range.from), to: endOfDay(range.to) };
      setDateRange(newRange);
      onDateRangeChange(newRange);
      onPeriodChange('custom');
    }
  };

  const clearFilters = () => {
    setDateRange(null);
    setSelectedPeriod('last30days');
    setCustomMode(false);
    onDateRangeChange(null);
    onPeriodChange('last30days');
  };

  const getDateRangeDisplay = () => {
    if (!dateRange) return 'Seleccionar rango';

    const from = format(dateRange.from, 'dd MMM yyyy', { locale: es });
    const to = format(dateRange.to, 'dd MMM yyyy', { locale: es });

    if (format(dateRange.from, 'yyyy-MM-dd') === format(dateRange.to, 'yyyy-MM-dd')) {
      return from;
    }

    return `${from} - ${to}`;
  };

  const getPeriodIcon = (period: string) => {
    switch (period) {
      case 'today':
      case 'yesterday':
        return <Clock className="h-4 w-4" />;
      case 'thisMonth':
      case 'lastMonth':
        return <CalendarIcon className="h-4 w-4" />;
      case 'thisQuarter':
      case 'thisYear':
      case 'lastYear':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className={`flex items-center space-x-4 ${className}`}>
      {/* Period Selector */}
      <div className="flex items-center space-x-2">
        <Filter className="h-4 w-4 text-gray-500" />
        <span className="text-sm text-gray-500">Período:</span>
      </div>

      <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-48">
          <div className="flex items-center space-x-2">
            {getPeriodIcon(selectedPeriod)}
            <SelectValue placeholder="Seleccionar período" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {PREDEFINED_PERIODS.map((period) => (
            <SelectItem key={period.value} value={period.value}>
              <div className="flex items-center space-x-2">
                {getPeriodIcon(period.value)}
                <span>{period.label}</span>
              </div>
            </SelectItem>
          ))}
          <SelectItem value="custom">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="h-4 w-4" />
              <span>Personalizado</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Custom Date Range Picker */}
      {customMode && (
        <div className="flex items-center space-x-2">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-64 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {getDateRangeDisplay()}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: dateRange?.from,
                  to: dateRange?.to
                }}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                locale={es}
              />
            </PopoverContent>
          </Popover>

          {dateRange && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Current Selection Display */}
      {dateRange && (
        <Badge variant="secondary" className="text-xs">
          {getDateRangeDisplay()}
        </Badge>
      )}

      {/* Quick Actions */}
      <div className="flex items-center space-x-2 ml-auto">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePeriodChange('today')}
        >
          Hoy
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePeriodChange('thisMonth')}
        >
          Este mes
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePeriodChange('thisYear')}
        >
          Este año
        </Button>
      </div>
    </div>
  );
}

// Hook for managing date filters across components
export function useDateFilter() {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [period, setPeriod] = useState<string>('last30days');

  const updateDateRange = (range: DateRange | null) => {
    setDateRange(range);
  };

  const updatePeriod = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  const getApiParams = () => {
    if (!dateRange) return {};

    return {
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString()
    };
  };

  return {
    dateRange,
    period,
    updateDateRange,
    updatePeriod,
    getApiParams
  };
}