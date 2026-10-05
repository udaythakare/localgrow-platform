package com.localgrow.v2;

import com.localgrow.v2.business.repository.BusinessRepository;
import com.localgrow.v2.coupon.repository.CouponRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@SpringBootTest
class LocalGrowV2ApplicationTests {

    @MockitoBean
    private BusinessRepository businessRepository;

    @MockitoBean
    private CouponRepository couponRepository;

    @MockitoBean
    private com.localgrow.v2.business.repository.BusinessHourRepository businessHourRepository;

    @Test
    void contextLoads() {
        // Verifies that the Spring application context starts cleanly
    }
}
