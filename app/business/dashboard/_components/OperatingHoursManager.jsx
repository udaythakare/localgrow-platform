'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const WEEKDAYS = [
    { dayOfWeek: 1, name: 'Monday', short: 'Mon' },
    { dayOfWeek: 2, name: 'Tuesday', short: 'Tue' },
    { dayOfWeek: 3, name: 'Wednesday', short: 'Wed' },
    { dayOfWeek: 4, name: 'Thursday', short: 'Thu' },
    { dayOfWeek: 5, name: 'Friday', short: 'Fri' },
    { dayOfWeek: 6, name: 'Saturday', short: 'Sat' },
    { dayOfWeek: 7, name: 'Sunday', short: 'Sun' },
];

const COMMON_TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+5:30)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+4:00)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+8:00)' },
    { value: 'Asia/Bangkok', label: 'Asia/Bangkok (ICT, UTC+7:00)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
    { value: 'UTC', label: 'UTC' },
];

function createDefaultSchedule() {
    return WEEKDAYS.map(({ dayOfWeek }) => ({
        dayOfWeek,
        openTime: dayOfWeek === 7 ? '00:00' : '09:00',
        closeTime: dayOfWeek === 7 ? '00:00' : '21:00',
        isClosed: dayOfWeek === 7,
        is24Hours: false,
    }));
}

export default function OperatingHoursManager({ locationId, initialTimezone = 'Asia/Kolkata' }) {
    const [schedule, setSchedule] = useState(createDefaultSchedule);
    const [timezone, setTimezone] = useState(initialTimezone);
    const [hasHoursConfigured, setHasHoursConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Fetch existing schedule
    useEffect(() => {
        if (!locationId) {
            setIsLoading(false);
            return;
        }

        let isMounted = true;

        async function fetchHours() {
            setIsLoading(true);
            setErrorMessage(null);
            try {
                const res = await fetch(`/api/vendors/operating-hours?locationId=${locationId}`);
                const json = await res.json();

                if (!res.ok) {
                    throw new Error(json.message || 'Failed to load operating hours');
                }

                if (isMounted && json.success && json.data) {
                    setTimezone(json.data.timezone || 'Asia/Kolkata');
                    setHasHoursConfigured(json.data.hasHoursConfigured);

                    if (json.data.hasHoursConfigured && Array.isArray(json.data.schedule) && json.data.schedule.length === 7) {
                        // Map 1..7 in order
                        const sorted = WEEKDAYS.map(w => {
                            const found = json.data.schedule.find(s => s.dayOfWeek === w.dayOfWeek);
                            return found ? {
                                dayOfWeek: w.dayOfWeek,
                                openTime: found.openTime || '09:00',
                                closeTime: found.closeTime || '21:00',
                                isClosed: Boolean(found.isClosed),
                                is24Hours: Boolean(found.is24Hours),
                            } : {
                                dayOfWeek: w.dayOfWeek,
                                openTime: '09:00',
                                closeTime: '21:00',
                                isClosed: false,
                                is24Hours: false,
                            };
                        });
                        setSchedule(sorted);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setErrorMessage(err.message);
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchHours();

        return () => {
            isMounted = false;
        };
    }, [locationId]);

    // Handle day mode changes: "open", "24hours", "closed"
    const handleModeChange = (dayOfWeek, mode) => {
        setSchedule(prev => prev.map(day => {
            if (day.dayOfWeek !== dayOfWeek) return day;

            if (mode === 'closed') {
                return { ...day, isClosed: true, is24Hours: false, openTime: '00:00', closeTime: '00:00' };
            }
            if (mode === '24hours') {
                return { ...day, isClosed: false, is24Hours: true, openTime: '00:00', closeTime: '00:00' };
            }
            // regular open hours
            const defaultOpen = day.openTime === '00:00' ? '09:00' : day.openTime;
            const defaultClose = day.closeTime === '00:00' ? '21:00' : day.closeTime;
            return {
                ...day,
                isClosed: false,
                is24Hours: false,
                openTime: defaultOpen,
                closeTime: defaultClose === defaultOpen ? '21:00' : defaultClose,
            };
        }));
    };

    const handleTimeChange = (dayOfWeek, field, value) => {
        setSchedule(prev => prev.map(day => {
            if (day.dayOfWeek !== dayOfWeek) return day;
            return { ...day, [field]: value };
        }));
    };

    // Quick helper: Copy Monday to weekdays (Mon-Fri)
    const copyMondayToWeekdays = () => {
        const monday = schedule.find(d => d.dayOfWeek === 1);
        if (!monday) return;
        setSchedule(prev => prev.map(day => {
            if (day.dayOfWeek >= 2 && day.dayOfWeek <= 5) {
                return {
                    ...day,
                    openTime: monday.openTime,
                    closeTime: monday.closeTime,
                    isClosed: monday.isClosed,
                    is24Hours: monday.is24Hours,
                };
            }
            return day;
        }));
        toast.success('Copied Monday hours to Tuesday–Friday');
    };

    // Quick helper: Copy Monday to all 7 days
    const copyMondayToAllDays = () => {
        const monday = schedule.find(d => d.dayOfWeek === 1);
        if (!monday) return;
        setSchedule(prev => prev.map(day => ({
            ...day,
            openTime: monday.openTime,
            closeTime: monday.closeTime,
            isClosed: monday.isClosed,
            is24Hours: monday.is24Hours,
        })));
        toast.success('Copied Monday hours to all 7 days');
    };

    // Validation
    const getValidationErrors = () => {
        const errors = [];
        for (const day of schedule) {
            const dayName = WEEKDAYS.find(w => w.dayOfWeek === day.dayOfWeek)?.name || `Day ${day.dayOfWeek}`;
            if (!day.isClosed && !day.is24Hours) {
                if (!day.openTime || !day.closeTime) {
                    errors.push(`${dayName}: Both opening and closing times are required.`);
                } else if (day.openTime === day.closeTime) {
                    errors.push(`${dayName}: Opening and closing times cannot be identical (select 24 Hours if open all day).`);
                }
            }
        }
        return errors;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        const errors = getValidationErrors();
        if (errors.length > 0) {
            setErrorMessage(errors[0]);
            toast.error(errors[0]);
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                locationId,
                timezone,
                schedule: schedule.map(day => ({
                    dayOfWeek: day.dayOfWeek,
                    openTime: day.isClosed || day.is24Hours ? '00:00' : day.openTime,
                    closeTime: day.isClosed || day.is24Hours ? '00:00' : day.closeTime,
                    isClosed: day.isClosed,
                    is24Hours: day.is24Hours,
                })),
            };

            const res = await fetch('/api/vendors/operating-hours', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.message || 'Failed to save operating hours');
            }

            setHasHoursConfigured(true);
            setSuccessMessage('Operating hours updated successfully! Changes are live immediately.');
            toast.success('Operating hours saved successfully');

        } catch (err) {
            setErrorMessage(err.message);
            toast.error(err.message || 'Error saving operating hours');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-center space-x-3 py-10">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-600 font-medium">Loading operating hours...</span>
                </div>
            </div>
        );
    }

    if (!locationId) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500">
                No location selected. Operating hours are attached to specific store locations.
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Header Status Banner */}
            <div className="p-5 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>🕒</span> Store Operating Hours
                        </h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Set your weekly schedule and location timezone. Open Now badges and hours will update in real time.
                        </p>
                    </div>

                    <div>
                        {hasHoursConfigured ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                                ● Hours Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ⚠️ Hours Not Configured
                            </span>
                        )}
                    </div>
                </div>

                {!hasHoursConfigured && (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-800 font-medium">
                        Your store currently appears as <strong>"Hours not configured"</strong> in nearby discovery. Configure your weekly schedule below and click Save to activate live store hours.
                    </div>
                )}
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-6">
                {/* Timezone Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div>
                        <label htmlFor="timezone-select" className="block text-sm font-bold text-gray-800">
                            Location Timezone
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Operating hours and overnight shifts evaluate against this timezone.
                        </p>
                    </div>
                    <select
                        id="timezone-select"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                        {COMMON_TIMEZONES.map(tz => (
                            <option key={tz.value} value={tz.value}>
                                {tz.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Quick Fill Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-1">Quick Tools:</span>
                    <button
                        type="button"
                        onClick={copyMondayToWeekdays}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors"
                    >
                        Copy Mon → Tue–Fri
                    </button>
                    <button
                        type="button"
                        onClick={copyMondayToAllDays}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors"
                    >
                        Copy Mon → All 7 Days
                    </button>
                </div>

                {/* Weekly Schedule Rows */}
                <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-200">
                    {schedule.map(day => {
                        const dayMeta = WEEKDAYS.find(w => w.dayOfWeek === day.dayOfWeek);
                        const isIdentical = !day.isClosed && !day.is24Hours && day.openTime === day.closeTime;

                        return (
                            <div
                                key={day.dayOfWeek}
                                className={`p-4 transition-colors ${day.isClosed ? 'bg-gray-50/70' : 'bg-white'}`}
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                    {/* Day Name */}
                                    <div className="w-32 flex-shrink-0">
                                        <span className="font-bold text-gray-900 block text-sm">
                                            {dayMeta?.name}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {day.isClosed ? 'Closed all day' : day.is24Hours ? 'Open 24 hours' : 'Scheduled shift'}
                                        </span>
                                    </div>

                                    {/* Mode Selector (Radio buttons) */}
                                    <div className="flex items-center space-x-4">
                                        <label className="inline-flex items-center text-xs font-semibold text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`mode-${day.dayOfWeek}`}
                                                checked={!day.isClosed && !day.is24Hours}
                                                onChange={() => handleModeChange(day.dayOfWeek, 'open')}
                                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                                            />
                                            <span className="ml-1.5">Custom Hours</span>
                                        </label>

                                        <label className="inline-flex items-center text-xs font-semibold text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`mode-${day.dayOfWeek}`}
                                                checked={day.is24Hours}
                                                onChange={() => handleModeChange(day.dayOfWeek, '24hours')}
                                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                                            />
                                            <span className="ml-1.5">24 Hours</span>
                                        </label>

                                        <label className="inline-flex items-center text-xs font-semibold text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name={`mode-${day.dayOfWeek}`}
                                                checked={day.isClosed}
                                                onChange={() => handleModeChange(day.dayOfWeek, 'closed')}
                                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                                            />
                                            <span className="ml-1.5">Closed</span>
                                        </label>
                                    </div>

                                    {/* Time Inputs */}
                                    <div className="flex items-center space-x-2">
                                        {!day.isClosed && !day.is24Hours ? (
                                            <div className="flex items-center space-x-2">
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-xs text-gray-500">From</span>
                                                    <input
                                                        type="time"
                                                        value={day.openTime}
                                                        onChange={(e) => handleTimeChange(day.dayOfWeek, 'openTime', e.target.value)}
                                                        className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                        aria-label={`${dayMeta?.name} opening time`}
                                                    />
                                                </div>
                                                <span className="text-gray-400">–</span>
                                                <div className="flex items-center space-x-1">
                                                    <span className="text-xs text-gray-500">To</span>
                                                    <input
                                                        type="time"
                                                        value={day.closeTime}
                                                        onChange={(e) => handleTimeChange(day.dayOfWeek, 'closeTime', e.target.value)}
                                                        className={`px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                                                            isIdentical ? 'border-red-500 bg-red-50' : 'border-gray-300'
                                                        }`}
                                                        aria-label={`${dayMeta?.name} closing time`}
                                                    />
                                                </div>
                                            </div>
                                        ) : day.is24Hours ? (
                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded border border-blue-200">
                                                Open 24 Hours (All day)
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded border border-gray-200">
                                                Closed
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {isIdentical && (
                                    <p className="text-xs text-red-600 mt-2 font-medium">
                                        ⚠️ Opening and closing times cannot be identical. If open 24 hours, select the "24 Hours" option above.
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Notifications & Action Bar */}
                {errorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 font-medium">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-700 font-medium">
                        {successMessage}
                    </div>
                )}

                <div className="flex items-center justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className={`px-6 py-2.5 rounded font-bold text-white shadow-sm transition-all ${
                            isSaving
                                ? 'bg-orange-400 cursor-not-allowed'
                                : 'bg-[#df6824] hover:bg-[#c85a1b] active:scale-[0.99]'
                        }`}
                    >
                        {isSaving ? 'Saving Weekly Schedule...' : 'Save Operating Hours'}
                    </button>
                </div>
            </form>
        </div>
    );
}
