package com.gcrapp.valuation.core.calculation

import com.gcrapp.valuation.data.models.AdditionsItemDto
import com.gcrapp.valuation.data.models.FloorItemDto
import com.gcrapp.valuation.data.models.PropertyDetailsDto
import com.gcrapp.valuation.data.models.SiteValueDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.math.BigInteger

class ValuationEngineTest {

    // --- 1. Decimal Precision & Validation Tests ---
    @Test
    fun testParseDecimalToScaled_ValidInputs() {
        val s1 = ValuationEngine.parseDecimalToScaled("123.45", 2, "Test")
        assertEquals(BigInteger.valueOf(12345L), s1)

        val s2 = ValuationEngine.parseDecimalToScaled("100.005", 2, "Test") // half-up to 100.01
        assertEquals(BigInteger.valueOf(10001L), s2)

        val s3 = ValuationEngine.parseDecimalToScaled("100.004", 2, "Test")
        assertEquals(BigInteger.valueOf(10000L), s3)
    }

    @Test
    fun testParseDecimalToScaled_RejectsNegative() {
        try {
            ValuationEngine.parseDecimalToScaled("-50.25", 2, "Rate")
            fail("Should have thrown IllegalArgumentException for negative input")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("cannot be negative"))
        }
    }

    @Test
    fun testParseDecimalToScaled_RejectsMalformed() {
        try {
            ValuationEngine.parseDecimalToScaled("abc123", 2, "Rate")
            fail("Should have thrown IllegalArgumentException for malformed input")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("invalid decimal number"))
        }
    }

    @Test
    fun testParseDecimalToScaled_RejectsOverflow() {
        try {
            ValuationEngine.parseDecimalToScaled("1234567890123456", 2, "Rate") // 16 digits
            fail("Should have thrown IllegalArgumentException for digit overflow")
        } catch (e: IllegalArgumentException) {
            assertTrue(e.message!!.contains("exceeds maximum allowable digits"))
        }
    }

    // --- 2. Land Extent Parsing Tests ---
    @Test
    fun testParseExtentToSqYards_SqYards() {
        val extent = ValuationEngine.parseExtentToSqYards("150 Sq. Yards")
        assertEquals(150.0, extent, 0.0001)
    }

    @Test
    fun testParseExtentToSqYards_Cents() {
        // 3.1 Cents * 48.4 = 150.04 Sq. Yards
        val extent = ValuationEngine.parseExtentToSqYards("3.1 Cents")
        assertEquals(150.04, extent, 0.0001)
    }

    @Test
    fun testParseExtentToSqYards_TeluguCents() {
        // 2.5 Cents * 48.4 = 121.0 Sq. Yards
        val extent = ValuationEngine.parseExtentToSqYards("2.5 సెంట్లు")
        assertEquals(121.0, extent, 0.0001)
    }

    @Test
    fun testParseExtentToSqYards_Ankanam() {
        // 20 Ankanams * 8.0 = 160.0 Sq. Yards
        val extent = ValuationEngine.parseExtentToSqYards("20 Ankanams")
        assertEquals(160.0, extent, 0.0001)
    }

    @Test
    fun testParseExtentToSqYards_SqFt() {
        // 900 Sq.Ft / 9.0 = 100.0 Sq. Yards
        val extent = ValuationEngine.parseExtentToSqYards("900 Sq.Ft")
        assertEquals(100.0, extent, 0.0001)
    }

    // --- 3. Fractional Extent & Fractional Unit Rate (Zero Floating Point Loss) ---
    @Test
    fun testFractionalExtentAndUnitRatePrecision() {
        // 142.375 Sq. Yards @ Rs 4521.85 / Sq Yd
        val extentScaled = ValuationEngine.parseExtentToSqYardsScaled("142.375 Sq. Yards")
        val rateScaled = ValuationEngine.parseDecimalToScaled("4521.85", 2)
        val productScaled = extentScaled.multiply(rateScaled)
        assertEquals("643798393750", productScaled.toString()) // scale 6

        // Scale down to paise with half-up rounding (add 5000 / 10000):
        val paise = productScaled.add(BigInteger.valueOf(5000L)).divide(BigInteger.valueOf(10000L))
        assertEquals(BigInteger.valueOf(64379839L), paise) // 64,379,839 paise (NOT 64,379,844)

        // Convert paise to integer Rupees with half-rupee bias (add 50 / 100):
        val rupees = paise.add(BigInteger.valueOf(50L)).divide(BigInteger.valueOf(100L))
        assertEquals(BigInteger.valueOf(643798L), rupees)

        val details = PropertyDetailsDto(
            netExtent = "142.375 Sq. Yards",
            propertyType = "Open Site",
            siteValue = SiteValueDto(ratePerSqYd = "4521.85", floors = emptyList())
        )
        val valuation = ValuationEngine.calculate(details, bankName = "APGB")
        assertEquals("SUCCESS", valuation.valuationStatus)
        assertEquals(643798.0, valuation.landValue, 0.0)
        assertEquals(643798.0, valuation.fairMarketValue, 0.0)
        // APGB Open Site: RV 90% = 643798 * 0.90 = 579418.2 -> 579418
        assertEquals(579418.0, valuation.realizableValue, 0.0)
        // APGB Open Site: DV 80% = 643798 * 0.80 = 515038.4 -> 515038
        assertEquals(515038.0, valuation.distressSaleValue, 0.0)
    }

    @Test
    fun testMissingLandRate_Rejected() {
        val details = PropertyDetailsDto(
            netExtent = "150 Sq. Yards",
            propertyType = "Open Site",
            siteValue = SiteValueDto(ratePerSqYd = "", floors = emptyList())
        )
        val valuation = ValuationEngine.calculate(details, bankName = "APGB")
        assertEquals("INVALID_INPUT", valuation.valuationStatus)
        assertTrue(valuation.errorMessage!!.contains("Land rate is required"))
    }

    // --- 4. Bank Policy Whitelist Tests ---
    @Test
    fun testCalculateValuation_APGB_IndependentHouse() {
        val details = PropertyDetailsDto(
            netExtent = "150 Sq. Yards",
            propertyType = "Independent House",
            structureType = "Framed structure",
            buildingAge = "10",
            siteValue = SiteValueDto(
                ratePerSqYd = "20000",
                floors = listOf(
                    FloorItemDto(id = "gf", label = "Ground Floor", value = "1000", rate = 1800.0)
                )
            ),
            additionsWork = listOf(
                AdditionsItemDto(description = "Compound Wall", amount = 75000.0)
            )
        )

        val valuation = ValuationEngine.calculate(details, bankName = "APGB")
        assertEquals("SUCCESS", valuation.valuationStatus)

        // Land value = 150 * 20000 = 3,000,000
        assertEquals(3000000.0, valuation.landValue, 0.0)
        assertEquals(1800000.0, valuation.replacementCost, 0.0)
        // Age 10 / Life 60 = 16.666% -> 17% depreciation
        assertEquals(17, valuation.depreciationPercent)
        assertEquals(306000.0, valuation.depreciationAmount, 0.0)
        assertEquals(1494000.0, valuation.netStructureValue, 0.0)
        assertEquals(75000.0, valuation.amenitiesValue, 0.0)

        // Fair Market Value = 3000000 + 1494000 + 75000 = 4569000
        assertEquals(4569000.0, valuation.fairMarketValue, 0.0)

        // APGB Option A: Realizable = 90% of FMV = 4112100
        assertEquals(4112100.0, valuation.realizableValue, 0.0)

        // APGB Option A: Distress = 80% of FMV = 3655200 (Directly from FMV!)
        assertEquals(3655200.0, valuation.distressSaleValue, 0.0)

        // Insurable Value = Net Structure + Amenities = 1494000 + 75000 = 1569000
        assertEquals(1569000.0, valuation.insurableValue, 0.0)
    }

    @Test
    fun testCalculateValuation_APGB_Apartment() {
        val details = PropertyDetailsDto(
            netExtent = "0 Sq. Yards",
            propertyType = "Apartment",
            structureType = "Framed structure",
            buildingAge = "2",
            siteValue = SiteValueDto(
                ratePerSqYd = "0",
                floors = listOf(
                    FloorItemDto(id = "flat", label = "Flat Area", value = "1200", rate = 2200.0)
                )
            )
        )

        val valuation = ValuationEngine.calculate(details, bankName = "APGB")
        assertEquals("SUCCESS", valuation.valuationStatus)
        // APGB Apartment: RV 85%, Distress 75%
        val expectedRealizable = Math.round(valuation.fairMarketValue * 0.85).toDouble()
        assertEquals(expectedRealizable, valuation.realizableValue, 0.0)

        val expectedDistress = Math.round(valuation.fairMarketValue * 0.75).toDouble()
        assertEquals(expectedDistress, valuation.distressSaleValue, 0.0)

        // Insurable value for flat = structure only (not land or site amenities)
        assertEquals(valuation.netStructureValue, valuation.insurableValue, 0.0)
    }

    @Test
    fun testCalculateValuation_APGB_AgriculturalLand() {
        val details = PropertyDetailsDto(
            netExtent = "100 Cents",
            propertyType = "Agricultural Land",
            siteValue = SiteValueDto(ratePerSqYd = "1200", floors = emptyList())
        )

        val valuation = ValuationEngine.calculate(details, bankName = "APGB")
        assertEquals("SUCCESS", valuation.valuationStatus)
        // 100 Cents = 4840 Sq Yds * 1200 = 5,808,000
        assertEquals(5808000.0, valuation.fairMarketValue, 0.0)
        // APGB Agri: RV 85% = 4936800, DV 75% = 4356000, Insurable = 0
        assertEquals(4936800.0, valuation.realizableValue, 0.0)
        assertEquals(4356000.0, valuation.distressSaleValue, 0.0)
        assertEquals(0.0, valuation.insurableValue, 0.0)
    }

    @Test
    fun testCalculateValuation_SBI_ResidentialBuilding() {
        val details = PropertyDetailsDto(
            netExtent = "200 Sq. Yards",
            propertyType = "Residential Building",
            structureType = "Framed structure",
            buildingAge = "5",
            siteValue = SiteValueDto(
                ratePerSqYd = "25000",
                floors = listOf(
                    FloorItemDto(id = "gf", label = "Ground Floor", value = "1500", rate = 2000.0)
                )
            )
        )

        val valuation = ValuationEngine.calculate(details, bankName = "State Bank of India")
        assertEquals("SUCCESS", valuation.valuationStatus)

        // SBI Option A: Realizable = 95% of FMV, Distress = 90% of FMV
        val expectedRealizable = Math.round(valuation.fairMarketValue * 0.95).toDouble()
        assertEquals(expectedRealizable, valuation.realizableValue, 0.0)

        val expectedDistress = Math.round(valuation.fairMarketValue * 0.90).toDouble()
        assertEquals(expectedDistress, valuation.distressSaleValue, 0.0)
    }

    @Test
    fun testCalculateValuation_SBI_UnsupportedCategories_Rejected() {
        val details = PropertyDetailsDto(
            netExtent = "100 Cents",
            propertyType = "Agricultural Land",
            siteValue = SiteValueDto(ratePerSqYd = "500")
        )

        val valuation = ValuationEngine.calculate(details, bankName = "State Bank of India")
        assertEquals("POLICY_NOT_CONFIGURED", valuation.valuationStatus)
        assertTrue(valuation.errorMessage!!.contains("No approved valuation policy"))
        assertEquals(0.0, valuation.realizableValue, 0.0)
        assertEquals(0.0, valuation.distressSaleValue, 0.0)
    }

    @Test
    fun testCalculateValuation_UnassignedBank_Rejected() {
        val details = PropertyDetailsDto(
            netExtent = "100 Sq. Yards",
            propertyType = "Independent House"
        )

        val valuation = ValuationEngine.calculate(details, bankName = null)
        assertEquals("BANK_UNASSIGNED", valuation.valuationStatus)
        assertTrue(valuation.errorMessage!!.contains("Bank name is required"))
    }

    // --- 5. v1 Historical Compatibility Test ---
    @Test
    fun testCalculateValuation_V1_UniversalShortcut_DistressFromRealizable() {
        val details = PropertyDetailsDto(
            netExtent = "100 Sq. Yards",
            propertyType = "Independent House",
            siteValue = SiteValueDto(ratePerSqYd = "10000", floors = emptyList())
        )

        val valuation = ValuationEngine.calculate(
            details,
            bankName = "APGB",
            engineVersion = "v1_universal_shortcut"
        )
        assertEquals("SUCCESS", valuation.valuationStatus)
        assertEquals(1000000.0, valuation.fairMarketValue, 0.0)
        // APGB RV 90% = 900,000
        assertEquals(900000.0, valuation.realizableValue, 0.0)
        // In v1_universal_shortcut, distress is 85% of Realizable Value = 900000 * 0.85 = 765,000
        // (Whereas v2_option_a would be 80% of FMV = 800,000)
        assertEquals(765000.0, valuation.distressSaleValue, 0.0)
    }

    // --- 6. High Net Worth Scaling Test ---
    @Test
    fun testCalculateValuation_HighNetWorthScaling() {
        val details = PropertyDetailsDto(
            netExtent = "40000 Sq. Yards",
            propertyType = "Independent House",
            siteValue = SiteValueDto(ratePerSqYd = "25000", floors = emptyList()) // 40,000 * 25,000 = 100 Crore (1,000,000,000)
        )

        val valuation = ValuationEngine.calculate(details, bankName = "State Bank of India")
        assertEquals("SUCCESS", valuation.valuationStatus)
        assertEquals(1000000000.0, valuation.fairMarketValue, 0.0)
        assertEquals(950000000.0, valuation.realizableValue, 0.0)
        assertEquals(900000000.0, valuation.distressSaleValue, 0.0)
    }
}
