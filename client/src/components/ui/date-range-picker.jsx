import React, { useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Calendar } from 'lucide-react';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

const DateRangePicker = ({ 
  value, 
  onChange, 
  placeholder = "Seleziona intervallo date",
  className 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [startDate, setStartDate] = useState(value?.from || '');
  const [endDate, setEndDate] = useState(value?.to || '');

  const handleApply = () => {
    if (startDate && endDate) {
      onChange({
        from: new Date(startDate),
        to: new Date(endDate)
      });
      setIsOpen(false);
    }
  };

  const formatDateRange = () => {
    if (value?.from && value?.to) {
      return `${format(value.from, 'dd/MM/yyyy', { locale: it })} - ${format(value.to, 'dd/MM/yyyy', { locale: it })}`;
    }
    return placeholder;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {formatDateRange()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="start-date">Data inizio</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">Data fine</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApply} className="flex-1">
              Applica
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Annulla
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { DateRangePicker, DateRangePicker as DatePickerWithRange };