import React from 'react';

/**
 * @deprecated Obsolete in LocalGrow.
 * Coupon validity is now authoritative via coupon.start_date and coupon.end_date.
 * Preserved for backward compatibility with existing component imports.
 */
const RedemptionDurationSelector = ({ value, onChange }) => {
    const durations = ['5 minutes', '10 minutes'];

    return (
        <div className="space-y-2">
            <label className="block font-bold text-lg">Redemption Duration</label>
            <div className="grid grid-cols-2 gap-3">
                {durations.map((duration) => (
                    <button
                        key={duration}
                        type="button"
                        onClick={() => onChange(duration)}
                        className={`p-3 border-2 border-black font-bold ${value === duration
                                ? 'bg-blue-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                : 'bg-white hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            } transition-all`}
                    >
                        {duration.charAt(0).toUpperCase() + duration.slice(1)}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default RedemptionDurationSelector;