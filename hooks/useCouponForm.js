// hooks/useCouponForm.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createCoupon, updateCoupon, getUserBusinesses } from '../app/business/dashboard/coupons/actions/couponActions';
import { prepareFormDataForSubmission } from '@/utils/dateUtils';

export const useCouponForm = (coupon) => {

    const router = useRouter();
    const isEditing = !!coupon?.id;

    const [businesses, setBusinesses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showWarning, setShowWarning] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        business_id: '',
        title: '',
        description: '',
        start_date: new Date().toISOString().slice(0, 16),
        end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        is_active: true,
        image_url: '',
        coupon_type: 'redeem_at_store', // always store redeem
        redeem_duration: null, // Deprecated: campaign end_date is authoritative
        max_claims: '',
        redemption_time_type: 'anytime',
        redemption_start_time: '09:00',
        redemption_end_time: '17:00',
    });

    useEffect(() => {

        async function loadInitialData() {

            setIsLoading(true);

            try {

                const businessesResult = await getUserBusinesses();

                if (businessesResult.businesses) {

                    setBusinesses(businessesResult.businesses);

                    if (isEditing && coupon) {

                        setFormData(prev => ({
                            ...prev,
                            ...coupon,
                            coupon_type: 'redeem_at_store' // force store redeem
                        }));

                    } else if (businessesResult.businesses.length > 0) {

                        setFormData(prev => ({
                            ...prev,
                            business_id: businessesResult.businesses[0].id
                        }));

                    }

                }

            } catch (error) {

                console.error('Error loading initial data:', error);

            } finally {

                setIsLoading(false);

            }

        }

        loadInitialData();

    }, [isEditing, coupon]);



    const validateForm = () => {

        const newErrors = {};

        const now = new Date();
        const startDate = new Date(formData.start_date);
        const endDate = new Date(formData.end_date);

        if (!formData.business_id) {
            newErrors.business_id = 'Please select a business';
        }

        if (!formData.title.trim()) {
            newErrors.title = 'Coupon title is required';
        }

        if (!formData.start_date) {
            newErrors.start_date = 'Start date is required';
        } 
        else if (startDate < now && !isEditing) {
            newErrors.start_date = 'Start date must be in the future';
        }

        if (!formData.end_date) {
            newErrors.end_date = 'End date is required';
        } 
        else if (endDate <= startDate) {
            newErrors.end_date = 'End date must be after start date';
        } 
        else if (endDate < now && !isEditing) {
            newErrors.end_date = 'End date must be in the future';
        }

        setErrors(newErrors);

        return Object.keys(newErrors).length === 0;

    };



    const handleSubmit = async (e) => {

        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        if (!showWarning) {
            setShowWarning(true);
            return;
        }

        setIsSubmitting(true);

        try {

            const submissionData = prepareFormDataForSubmission({
                ...formData,
                coupon_type: 'redeem_at_store' // enforce store redeem
            });

            let result;

            if (isEditing && coupon?.id) {
                result = await updateCoupon(coupon.id, submissionData);
            } 
            else {
                result = await createCoupon(submissionData);
            }

            if (result.error) {
                setErrors({ form: result.error });
                return;
            }

            router.push('/business/dashboard/coupons');
            router.refresh();

        } catch (error) {

            console.error('Error submitting form:', error);

            setErrors({ form: 'Failed to save coupon. Please try again.' });

        } finally {

            setIsSubmitting(false);

        }

    };



    const handleChange = (e) => {

        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

    };



    return {

        formData,
        setFormData,
        businesses,
        isLoading,
        showWarning,
        setShowWarning,
        isSubmitting,
        errors,
        setErrors,
        isEditing,
        handleSubmit,
        handleChange,

    };

};