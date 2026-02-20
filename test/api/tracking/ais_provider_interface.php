<?php
interface AISProviderInterface {
    /**
     * Get vessel position from AIS data source
     * @param string|null $imo IMO number
     * @param string|null $mmsi MMSI number
     * @return array|null ['lat', 'lon', 'speed', 'course', 'destination', 'eta', 'lastUpdate', 'source']
     */
    public function getVesselPosition($imo = null, $mmsi = null);
}
