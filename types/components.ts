/**
 * PC Build Advisor - Component type definitions
 */

// ============ Base Types ============

export type FormFactor = "ATX" | "Micro-ATX" | "Mini-ITX" | "E-ATX";

export type MemoryType = "DDR4" | "DDR5";

export type PcieVersion = "3.0" | "4.0" | "5.0";

// ============ CPU ============

export interface CPU {
  id: string;
  name: string;
  manufacturer: "Intel" | "AMD";
  price_usd?: number;
  specs: {
    brand: "Intel" | "AMD";
    socket: string;
    cores: number;
    threads: number;
    base_clock_ghz: number;
    boost_clock_ghz?: number;
    tdp_w: number;
    max_mem_speed_mhz: number;
    memory_type: MemoryType;
    pcie_version: PcieVersion;
    has_igpu: boolean;
    tier: number; // 1-10, higher = better performance
    /** ECC memory support (Xeon, EPYC, Ryzen Pro, some consumer) */
    supports_ecc?: boolean;
  };
}

// ============ GPU ============

export type PowerConnector = "8-pin" | "12-pin" | "16-pin" | "6-pin";

/** GPU power connector requirements (e.g. "1x16pin" 12VHPWR, "2x8pin") */
export type GPUPowerConnector =
  | "1x16pin"
  | "1x12vhpwr"
  | "2x8pin"
  | "3x8pin"
  | "1x8pin"
  | "1x8pin+1x6pin"
  | "2x8pin+1x6pin"
  | "1x6pin";

export interface GPU {
  id: string;
  name: string;
  manufacturer: "NVIDIA" | "AMD";
  price_usd?: number;
  specs: {
    brand: "NVIDIA" | "AMD";
    length_mm: number;
    thickness_slots: number;
    tdp_w: number;
    /** Power connector(s) - legacy e.g. "16-pin"/"8-pin" or new e.g. "1x16pin"/"2x8pin" */
    power_connectors: (PowerConnector | GPUPowerConnector)[];
    pcie_version: PcieVersion;
    vram_gb: number;
    tier: number; // 1-10
    /** Transient power spike (for ATX 3.0 / 12VHPWR validation) */
    peak_power_w?: number;
  };
}

// ============ Motherboard ============

export interface MotherboardHeaders {
  fan_4pin: number; // PWM fan headers
  fan_3pin?: number; // DC fan headers (optional)
  rgb_12v?: number; // 12V RGB headers (4-pin)
  argb_5v: number; // 5V ARGB headers (3-pin)
  usb2_internal: number; // Internal USB 2.0 headers (9-pin)
  usb3_internal: number; // Internal USB 3.0 headers (19-pin)
  usb_c_internal: number; // Internal USB-C header (Type-E, 20-pin)
}

export interface Motherboard {
  id: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: {
    socket: string;
    chipset: string;
    form_factor: FormFactor;
    memory_type: MemoryType;
    ram_slots: number;
    max_ram_gb: number;
    m2_slots: number;
    sata_ports: number;
    pcie_version: PcieVersion;
    has_bios_flashback: boolean;
    headers?: MotherboardHeaders;
    /** Max official JEDEC memory speed in MT/s (stock) */
    max_memory_speed_stock_mhz?: number;
    /** Max memory speed with XMP/EXPO enabled in MT/s */
    max_memory_speed_oc_mhz?: number;
    /** Whether the board supports Intel XMP profiles */
    supports_xmp?: boolean;
    /** Whether the board supports AMD EXPO profiles */
    supports_expo?: boolean;
    /** ECC memory support (workstation/server boards) */
    supports_ecc?: boolean;
  };
}

// ============ RAM ============

export interface RAM {
  id: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: {
    memory_type: MemoryType;
    capacity_gb: number;
    speed_mhz: number;
    modules: number; // number of sticks
    latency: string; // e.g. "CL36"
    voltage_v?: number;
    /** Error-Correcting Code (workstation/server) */
    is_ecc?: boolean;
    /** Registered (RDIMM) vs unbuffered (UDIMM); servers often use RDIMM */
    is_registered?: boolean;
    /** Type of RGB on RAM, if any */
    rgb_type?: "none" | "12v_rgb" | "5v_argb";
  };
}

// ============ Storage ============

export type StorageInterface = "NVMe" | "SATA";

export type StorageFormFactor = "M.2 2280" | "2.5\" SATA" | "3.5\" SATA";

export interface Storage {
  id: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: {
    interface: StorageInterface;
    form_factor: StorageFormFactor;
    capacity_gb: number;
    read_speed_mb_s?: number;
    write_speed_mb_s?: number;
    tbw?: number; // Total Bytes Written endurance
    /** Physical size for drive-bay clearance (derived from form_factor if omitted) */
    physical_size?: "2.5" | "3.5" | "m.2";
  };
}

// ============ PSU ============

export type PsuEfficiency = "80+ Bronze" | "80+ Silver" | "80+ Gold" | "80+ Platinum" | "80+ Titanium";

/** PSU power connector counts for GPU/CPU validation */
export interface PSUConnectors {
  pin_24_main: number;
  pin_8_cpu: number;
  pin_8_pcie: number;
  pin_6_pcie?: number;
  /** 12VHPWR (ATX 3.0) or 12V-2x6 (ATX 3.1) */
  pin_16_12vhpwr?: number;
  sata: number;
  molex?: number;
}

export interface PSU {
  id: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: {
    wattage_w: number;
    efficiency: PsuEfficiency;
    form_factor: "ATX" | "SFX" | "SFX-L";
    modular: "Non-modular" | "Semi-modular" | "Fully modular";
    atx_version?: "2.x" | "3.0"; // ATX 3.0 has 12VHPWR
    /** ATX standard for 12VHPWR / transient validation (use when available) */
    atx_standard?: "ATX2.x" | "ATX3.0" | "ATX3.1";
    pcie_5_ready: boolean;
    /** PSU length in mm (for case clearance validation) */
    length_mm?: number;
    /** Detailed connector counts for GPU power validation */
    connectors?: PSUConnectors;
  };
}

// ============ Cooler ============

export type CoolerType = "Air" | "AIO";

export interface Cooler {
  id: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: {
    type: CoolerType;
    tdp_rating_w?: number; // for air coolers
    radiator_size_mm?: number; // for AIO: 120, 240, 280, 360
    fan_size_mm?: number;
    height_mm?: number; // for air coolers - RAM clearance
    sockets: string[]; // compatible sockets
    /** AIO: total radiator + fan thickness in mm (for case mount clearance) */
    radiator_fan_thickness_mm?: number;
    /** Number of fans (e.g. 1 for single-tower, 2 for D15, 3 for 360 AIO) */
    fan_count?: number;
    /** Type of RGB on cooler */
    rgb_type?: "none" | "12v_rgb" | "5v_argb";
  };
}

// ============ Case ============

export interface CaseFrontPanel {
  usb_a?: number;
  usb_c?: number;
  audio_jack: boolean;
}

export interface Case {
  id: string;
  name: string;
  manufacturer: string;
  price_usd?: number;
  specs: {
    form_factor: FormFactor;
    max_gpu_length_mm: number;
    max_cooler_height_mm: number;
    /** Max PSU length in mm (for PSU length validation) */
    max_psu_length_mm?: number;
    /** Max GPU thickness in PCIe slots (e.g. 3 = triple-slot) */
    max_gpu_thickness_slots?: number;
    drive_bays_2_5: number;
    drive_bays_3_5: number;
    /** When a 3.5" drive is installed, GPU max length is reduced by this many mm (ITX/small cases) */
    drive_35_reduces_gpu_length?: number;
    /** When a 3.5" drive is installed, PSU max length is reduced by this many mm (ITX/small cases) */
    drive_35_reduces_psu_length?: number;
    /** Which clearances are affected by 3.5" drive bay usage */
    drive_35_conflicts_with?: "psu" | "gpu" | "both";
    expansion_slots: number;
    /** Supported radiator sizes in mm, e.g. [240, 360] */
    supports_radiator_mm?: number[];
    /** Max radiator + fan thickness in mm for top/front mount */
    max_radiator_thickness_mm?: number;
    max_psu_form_factor: "ATX" | "SFX" | "SFX-L";
    /** Front panel I/O */
    front_panel?: CaseFrontPanel;
    /** Number of fans included with case */
    preinstalled_fans?: number;
    /** Maximum number of fan positions */
    max_fans?: number;
    /** Type of RGB on case lighting / fans, if any */
    rgb_type?: "none" | "12v_rgb" | "5v_argb";
    /** Number of pre-installed RGB fans (subset of preinstalled_fans) */
    rgb_fans?: number;
    /** Whether the case has sound-dampening panels */
    noise_dampening?: boolean;
    /** Whether the front panel is mesh (more airflow, less damping) */
    mesh_front?: boolean;
  };
}

// ============ Union Types ============

export type PCComponent = CPU | GPU | Motherboard | RAM | Storage | PSU | Cooler | Case;
