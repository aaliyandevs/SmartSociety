/**
 * SmartSociety demo data.
 *
 * Produces a realistic, fully-linked society: four towers, 48 flats, owners and
 * tenants, five months of billing history with payments, a live helpdesk queue,
 * amenity bookings, gate traffic, notices, polls and an audit trail.
 *
 * Run with:  npm run db:seed        (or `npx prisma db seed`)
 *
 * The script is idempotent-by-reset: it clears the tables it owns first, so it
 * can be re-run at any time without duplicating records.
 */
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  BillStatus,
  BookingStatus,
  ChargeType,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
  FlatType,
  GateLogStatus,
  GatePassStatus,
  NoticeAudience,
  NoticeCategory,
  NoticePriority,
  NotificationType,
  OccupancyStatus,
  PaymentMethod,
  PaymentStatus,
  PollStatus,
  Prisma,
  PrismaClient,
  ResidentType,
  Role,
  StaffDepartment,
  VehicleType,
  VerificationMethod,
  VisitorType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Deterministic pseudo-randomness ──────────────────────────────────────────
// A fixed seed keeps every run of the demo identical, which matters when the
// documentation and test cases quote specific numbers.

let randomState = 987_654_321;
function random(): number {
  randomState = (randomState * 1_664_525 + 1_013_904_223) % 4_294_967_296;
  return randomState / 4_294_967_296;
}
const randomInt = (min: number, max: number) => Math.floor(random() * (max - min + 1)) + min;
const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const pickSome = <T,>(items: readonly T[], count: number): T[] => {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
};
const chance = (probability: number) => random() < probability;

// ── Date helpers ──────────────────────────────────────────────────────────────

const NOW = new Date();
const startOfToday = () => new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const daysAgo = (days: number, hour = 9, minute = 0) => {
  const date = new Date(NOW);
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
};
const daysAhead = (days: number, hour = 9, minute = 0) => daysAgo(-days, hour, minute);
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000);
const hoursAhead = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);

// ── Reference data ────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Ananya', 'Diya', 'Ishaan', 'Kabir', 'Meera', 'Nikhil', 'Priya',
  'Rohan', 'Sanya', 'Tanvi', 'Varun', 'Zoya', 'Arjun', 'Kavya', 'Manish', 'Neha', 'Rahul',
  'Shreya', 'Siddharth', 'Pooja', 'Vikram', 'Anjali', 'Deepak', 'Farah', 'Gaurav', 'Harini', 'Imran',
  'Jyoti', 'Karthik', 'Lakshmi', 'Mohit', 'Nandini', 'Omkar',
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Nair', 'Iyer', 'Mehta', 'Kulkarni', 'Joshi', 'Desai',
  'Chopra', 'Bansal', 'Rao', 'Gupta', 'Khan', 'Sethi', 'Malhotra', 'Pillai', 'Bose', 'Chauhan',
];

const OCCUPATIONS = [
  'Software Engineer', 'Chartered Accountant', 'School Teacher', 'Doctor', 'Architect',
  'Bank Manager', 'Civil Engineer', 'Marketing Consultant', 'Retired', 'Business Owner',
  'Data Analyst', 'Lawyer', 'Pharmacist', 'Interior Designer',
];

const VEHICLE_MAKES = [
  { make: 'Maruti Suzuki', models: ['Swift', 'Baleno', 'Brezza'], type: VehicleType.CAR },
  { make: 'Hyundai', models: ['i20', 'Creta', 'Venue'], type: VehicleType.CAR },
  { make: 'Tata', models: ['Nexon', 'Punch', 'Altroz'], type: VehicleType.CAR },
  { make: 'Honda', models: ['City', 'Amaze'], type: VehicleType.CAR },
  { make: 'Honda', models: ['Activa 6G', 'Dio'], type: VehicleType.SCOOTER },
  { make: 'Royal Enfield', models: ['Classic 350', 'Hunter 350'], type: VehicleType.BIKE },
  { make: 'Bajaj', models: ['Pulsar 150', 'Chetak'], type: VehicleType.BIKE },
];

const COLORS = ['White', 'Silver', 'Grey', 'Blue', 'Red', 'Black'];
const RELATIONS = ['Spouse', 'Son', 'Daughter', 'Mother', 'Father', 'Brother', 'Sister'];

const DELIVERY_COMPANIES = ['Amazon', 'Flipkart', 'BlueDart', 'Swiggy', 'Zomato', 'Blinkit', 'DTDC'];
const CAB_COMPANIES = ['Uber', 'Ola', 'Rapido'];
const VENDOR_COMPANIES = ['Aqua Pure RO Service', 'UrbanClap Cleaning', 'Sharma Electricals', 'Godrej Pest Control'];

const GATES = ['Main Gate', 'Service Gate'] as const;

// ── Password helpers ──────────────────────────────────────────────────────────

const DEMO_PASSWORDS = {
  admin: 'Admin@12345',
  resident: 'Resident@12345',
  guard: 'Guard@12345',
  maintenance: 'Maintenance@12345',
  /** Every non-headline demo account shares this password (documented in the README). */
  shared: 'Society@12345',
} as const;

// ── Code generators (mirrors lib/codes.ts, inlined so the seed has no app deps) ─

const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const randomCode = (length: number) =>
  Array.from({ length }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('');

const usedGateCodes = new Set<string>();
function uniqueGateCode(): string {
  let code: string;
  do {
    code = String(randomInt(100_000, 999_999));
  } while (usedGateCodes.has(code));
  usedGateCodes.add(code);
  return code;
}

const phoneFor = (index: number) => `9${String(800_000_000 + index * 137_911).slice(0, 9)}`;
const plate = (index: number) =>
  `MH${String(randomInt(1, 48)).padStart(2, '0')}${randomCode(2)}${String(1000 + index).slice(-4)}`;

const money = (value: number) => new Prisma.Decimal(value.toFixed(2));

// ─────────────────────────────────────────────────────────────────────────────

async function reset() {
  console.log('  Clearing existing data…');
  // Order matters: children before parents (most relations cascade, but being
  // explicit keeps the script readable and safe if a relation changes).
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.pollVote.deleteMany(),
    prisma.pollOption.deleteMany(),
    prisma.poll.deleteMany(),
    prisma.noticeRead.deleteMany(),
    prisma.notice.deleteMany(),
    prisma.emergencyAlert.deleteMany(),
    prisma.amenityBooking.deleteMany(),
    prisma.amenity.deleteMany(),
    prisma.complaintUpdate.deleteMany(),
    prisma.complaintAttachment.deleteMany(),
    prisma.complaint.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.billCharge.deleteMany(),
    prisma.maintenanceBill.deleteMany(),
    prisma.gateLog.deleteMany(),
    prisma.gatePass.deleteMany(),
    prisma.visitor.deleteMany(),
    prisma.emergencyContact.deleteMany(),
    prisma.vehicle.deleteMany(),
    prisma.familyMember.deleteMany(),
    prisma.residentProfile.deleteMany(),
    prisma.staffProfile.deleteMany(),
    prisma.session.deleteMany(),
    prisma.user.deleteMany(),
    prisma.flat.deleteMany(),
    prisma.block.deleteMany(),
    prisma.society.deleteMany(),
  ]);
}

async function main() {
  console.log('\nSeeding SmartSociety demo data\n');
  await reset();

  // Hash each distinct password once — bcrypt at cost 12 is deliberately slow.
  console.log('  Hashing passwords…');
  const hashes = {
    admin: await bcrypt.hash(DEMO_PASSWORDS.admin, 12),
    resident: await bcrypt.hash(DEMO_PASSWORDS.resident, 12),
    guard: await bcrypt.hash(DEMO_PASSWORDS.guard, 12),
    maintenance: await bcrypt.hash(DEMO_PASSWORDS.maintenance, 12),
    shared: await bcrypt.hash(DEMO_PASSWORDS.shared, 12),
  };

  // ── Society ────────────────────────────────────────────────────────────────

  const society = await prisma.society.create({
    data: {
      name: 'Green Meadows Residency',
      registrationNo: 'MH/PUN/CHS/2016/48219',
      addressLine1: 'Survey No. 42, Green Meadows Road',
      addressLine2: 'Baner',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411045',
      contactEmail: 'office@smartsociety.local',
      contactPhone: '9822014567',
      penaltyPercent: money(2),
      penaltyGraceDays: 5,
      guidelines: SOCIETY_GUIDELINES,
    },
  });
  console.log(`  Society: ${society.name}`);

  // ── Blocks & flats ─────────────────────────────────────────────────────────

  const BLOCK_SPECS = [
    { name: 'A', label: 'Tower A — Garden View', floors: 6 },
    { name: 'B', label: 'Tower B — Pool Side', floors: 6 },
    { name: 'C', label: 'Tower C — East Wing', floors: 6 },
    { name: 'D', label: 'Tower D — Clubhouse Wing', floors: 6 },
  ];

  const FLAT_MIX: { type: FlatType; area: number; maintenance: number; parking: number }[] = [
    { type: FlatType.TWO_BHK, area: 980, maintenance: 3200, parking: 1 },
    { type: FlatType.THREE_BHK, area: 1340, maintenance: 4400, parking: 2 },
  ];

  const blocks = [];
  for (const spec of BLOCK_SPECS) {
    blocks.push(
      await prisma.block.create({
        data: { societyId: society.id, name: spec.name, label: spec.label, totalFloors: spec.floors },
      }),
    );
  }

  type SeededFlat = { id: string; label: string; blockName: string; flatNumber: string; maintenance: number };
  const flats: SeededFlat[] = [];

  for (const [blockIndex, block] of blocks.entries()) {
    const spec = BLOCK_SPECS[blockIndex];
    for (let floor = 1; floor <= spec.floors; floor += 1) {
      for (let unit = 1; unit <= 2; unit += 1) {
        const mix = FLAT_MIX[unit - 1];
        const flatNumber = `${floor}0${unit}`;
        const flat = await prisma.flat.create({
          data: {
            blockId: block.id,
            flatNumber,
            floor,
            flatType: mix.type,
            carpetAreaSqft: mix.area,
            parkingSlots: mix.parking,
            baseMaintenance: money(mix.maintenance),
            occupancyStatus: OccupancyStatus.VACANT,
          },
        });
        flats.push({
          id: flat.id,
          label: `${block.name}-${flatNumber}`,
          blockName: block.name,
          flatNumber,
          maintenance: mix.maintenance,
        });
      }
    }
  }
  console.log(`  Blocks: ${blocks.length} · Flats: ${flats.length}`);

  // ── Administrators ─────────────────────────────────────────────────────────

  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartsociety.local',
      username: 'admin',
      passwordHash: hashes.admin,
      role: Role.ADMIN,
      fullName: 'Rajesh Deshmukh',
      phone: '9822014567',
      lastLoginAt: hoursAgo(3),
    },
  });

  const secretary = await prisma.user.create({
    data: {
      email: 'secretary@smartsociety.local',
      username: 'secretary',
      passwordHash: hashes.shared,
      role: Role.ADMIN,
      fullName: 'Sunita Kulkarni',
      phone: '9822014568',
      lastLoginAt: daysAgo(1, 11),
    },
  });

  // ── Residents ──────────────────────────────────────────────────────────────

  interface SeededResident {
    residentId: string;
    userId: string;
    fullName: string;
    email: string;
    flat: SeededFlat;
    residentType: ResidentType;
  }

  const residents: SeededResident[] = [];
  // 38 of the 48 flats are occupied; the rest stay vacant so the occupancy map
  // has something to show.
  const occupiedFlats = flats.slice(0, 38);

  for (const [index, flat] of occupiedFlats.entries()) {
    const isDemoResident = index === 0;
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index * 3) % LAST_NAMES.length];
    const fullName = isDemoResident ? 'Ananya Sharma' : `${firstName} ${lastName}`;
    const email = isDemoResident
      ? 'resident@smartsociety.local'
      : `${firstName}.${lastName}${index}`.toLowerCase() + '@smartsociety.local';
    const residentType = chance(0.72) ? ResidentType.OWNER : ResidentType.TENANT;

    const user = await prisma.user.create({
      data: {
        email,
        username: isDemoResident ? 'resident' : `${firstName}${index}`.toLowerCase(),
        passwordHash: isDemoResident ? hashes.resident : hashes.shared,
        role: Role.RESIDENT,
        fullName,
        phone: phoneFor(index + 1),
        lastLoginAt: chance(0.8) ? hoursAgo(randomInt(1, 200)) : null,
      },
    });

    const profile = await prisma.residentProfile.create({
      data: {
        userId: user.id,
        flatId: flat.id,
        residentType,
        isPrimary: true,
        moveInDate: daysAgo(randomInt(120, 1800)),
        occupation: pick(OCCUPATIONS),
        alternatePhone: chance(0.4) ? phoneFor(index + 500) : null,
      },
    });

    await prisma.flat.update({
      where: { id: flat.id },
      data: { occupancyStatus: OccupancyStatus.OCCUPIED, occupancyType: residentType },
    });

    residents.push({
      residentId: profile.id,
      userId: user.id,
      fullName,
      email,
      flat,
      residentType,
    });

    // Family members
    for (let i = 0; i < randomInt(1, 3); i += 1) {
      await prisma.familyMember.create({
        data: {
          residentId: profile.id,
          fullName: `${pick(FIRST_NAMES)} ${lastName}`,
          relation: pick(RELATIONS),
          age: randomInt(4, 74),
          phone: chance(0.5) ? phoneFor(index * 7 + i + 900) : null,
          isDependent: chance(0.45),
        },
      });
    }

    // Vehicles
    for (let i = 0; i < randomInt(1, 2); i += 1) {
      const vehicle = pick(VEHICLE_MAKES);
      await prisma.vehicle.create({
        data: {
          residentId: profile.id,
          flatId: flat.id,
          registrationNo: plate(index * 10 + i),
          vehicleType: vehicle.type,
          make: vehicle.make,
          model: pick(vehicle.models),
          color: pick(COLORS),
          parkingSlot: `${flat.blockName}-P${String(index * 2 + i + 1).padStart(2, '0')}`,
        },
      });
    }

    // Personal emergency contacts
    if (isDemoResident || chance(0.5)) {
      await prisma.emergencyContact.create({
        data: {
          residentId: profile.id,
          scope: 'RESIDENT_PERSONAL',
          name: `${pick(FIRST_NAMES)} ${lastName}`,
          relation: pick(RELATIONS),
          phone: phoneFor(index + 1200),
        },
      });
    }
  }

  // A couple of tenants sharing already-owned flats, so "Flats → Residents"
  // one-to-many is visible in the data.
  for (const flat of occupiedFlats.slice(0, 4)) {
    const index = residents.length;
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const user = await prisma.user.create({
      data: {
        email: `${firstName}.${lastName}${index}`.toLowerCase() + '@smartsociety.local',
        username: `${firstName}${index}`.toLowerCase(),
        passwordHash: hashes.shared,
        role: Role.RESIDENT,
        fullName: `${firstName} ${lastName}`,
        phone: phoneFor(index + 60),
      },
    });
    const profile = await prisma.residentProfile.create({
      data: {
        userId: user.id,
        flatId: flat.id,
        residentType: ResidentType.TENANT,
        isPrimary: false,
        moveInDate: daysAgo(randomInt(60, 500)),
        occupation: pick(OCCUPATIONS),
      },
    });
    residents.push({
      residentId: profile.id,
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      flat,
      residentType: ResidentType.TENANT,
    });
  }

  const demoResident = residents[0];
  console.log(`  Residents: ${residents.length} (demo: ${demoResident.fullName}, flat ${demoResident.flat.label})`);

  // ── Security guards ────────────────────────────────────────────────────────

  const GUARD_SPECS = [
    { name: 'Ramesh Yadav', email: 'guard@smartsociety.local', username: 'guard', gate: 'Main Gate', shift: 'Morning (06:00 – 14:00)', hash: hashes.guard },
    { name: 'Suresh Pawar', email: 'guard2@smartsociety.local', username: 'guard2', gate: 'Main Gate', shift: 'Evening (14:00 – 22:00)', hash: hashes.shared },
    { name: 'Dinesh Jadhav', email: 'guard3@smartsociety.local', username: 'guard3', gate: 'Service Gate', shift: 'Night (22:00 – 06:00)', hash: hashes.shared },
  ];

  const guards = [];
  for (const [index, spec] of GUARD_SPECS.entries()) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        username: spec.username,
        passwordHash: spec.hash,
        role: Role.GUARD,
        fullName: spec.name,
        phone: phoneFor(index + 300),
        lastLoginAt: hoursAgo(randomInt(1, 12)),
      },
    });
    const profile = await prisma.staffProfile.create({
      data: {
        userId: user.id,
        employeeCode: `SEC-${randomCode(4)}`,
        department: StaffDepartment.SECURITY,
        designation: 'Security Guard',
        shift: spec.shift,
        gateAssignment: spec.gate,
        skills: ['Visitor screening', 'CCTV monitoring'],
        joinedAt: daysAgo(randomInt(200, 900)),
      },
    });
    guards.push({ userId: user.id, staffId: profile.id, name: spec.name, gate: spec.gate });
  }

  // ── Maintenance staff ──────────────────────────────────────────────────────

  const STAFF_SPECS = [
    { name: 'Mahesh Gaikwad', email: 'maintenance@smartsociety.local', username: 'maintenance', dept: StaffDepartment.PLUMBING, designation: 'Senior Plumber', skills: ['Leak repair', 'Pipe fitting', 'Water pump'], hash: hashes.maintenance },
    { name: 'Anil Shinde', email: 'electrician@smartsociety.local', username: 'electrician', dept: StaffDepartment.ELECTRICAL, designation: 'Electrician', skills: ['Wiring', 'DB repair', 'Lighting'], hash: hashes.shared },
    { name: 'Prakash More', email: 'lift@smartsociety.local', username: 'lifttech', dept: StaffDepartment.ELEVATOR, designation: 'Lift Technician', skills: ['Elevator servicing', 'Door alignment'], hash: hashes.shared },
    { name: 'Kavita Salunkhe', email: 'housekeeping@smartsociety.local', username: 'housekeeping', dept: StaffDepartment.HOUSEKEEPING, designation: 'Housekeeping Supervisor', skills: ['Deep cleaning', 'Waste management'], hash: hashes.shared },
    { name: 'Ravi Bhosale', email: 'gardening@smartsociety.local', username: 'gardener', dept: StaffDepartment.GARDENING, designation: 'Head Gardener', skills: ['Landscaping', 'Irrigation'], hash: hashes.shared },
    { name: 'Sameer Kadam', email: 'handyman@smartsociety.local', username: 'handyman', dept: StaffDepartment.GENERAL, designation: 'Multi-skill Technician', skills: ['Carpentry', 'Pest control', 'General repairs'], hash: hashes.shared },
  ];

  const staff = [];
  for (const [index, spec] of STAFF_SPECS.entries()) {
    const user = await prisma.user.create({
      data: {
        email: spec.email,
        username: spec.username,
        passwordHash: spec.hash,
        role: Role.MAINTENANCE_STAFF,
        fullName: spec.name,
        phone: phoneFor(index + 400),
        lastLoginAt: hoursAgo(randomInt(2, 60)),
      },
    });
    const profile = await prisma.staffProfile.create({
      data: {
        userId: user.id,
        employeeCode: `EMP-${randomCode(4)}`,
        department: spec.dept,
        designation: spec.designation,
        shift: 'General (09:00 – 18:00)',
        skills: spec.skills,
        joinedAt: daysAgo(randomInt(150, 1200)),
      },
    });
    staff.push({ userId: user.id, staffId: profile.id, name: spec.name, department: spec.dept });
  }
  console.log(`  Staff: ${guards.length} guards, ${staff.length} technicians`);

  // ── Society emergency directory ────────────────────────────────────────────

  const DIRECTORY = [
    { name: 'Society Office', designation: 'Reception & Manager', phone: '9822014567', order: 1 },
    { name: 'Main Gate Security', designation: 'Security Desk (24×7)', phone: '9822014570', order: 2 },
    { name: 'Fire Brigade', designation: 'Pune Fire Control Room', phone: '9822010101', order: 3 },
    { name: 'Ambulance', designation: 'Emergency Medical Response', phone: '9822010208', order: 4 },
    { name: 'Police Control Room', designation: 'Baner Police Station', phone: '9822010010', order: 5 },
    { name: 'Sahyadri Multispeciality Hospital', designation: 'Nearest Hospital (2.4 km)', phone: '9822011122', order: 6 },
    { name: 'Gas Emergency Helpline', designation: 'LPG Leak Response', phone: '9822011612', order: 7 },
    { name: 'Water Tanker Service', designation: 'Approved Supplier', phone: '9822013344', order: 8 },
    { name: 'Elevator AMC — Otis Service', designation: 'Lift Breakdown Support', phone: '9822013900', order: 9 },
  ];

  for (const entry of DIRECTORY) {
    await prisma.emergencyContact.create({
      data: {
        scope: 'SOCIETY_DIRECTORY',
        name: entry.name,
        designation: entry.designation,
        phone: entry.phone,
        sortOrder: entry.order,
      },
    });
  }

  // ── Amenities ──────────────────────────────────────────────────────────────

  const AMENITY_SPECS = [
    { name: 'Clubhouse', slug: 'clubhouse', location: 'Tower D, Ground Floor', capacity: 80, open: 8 * 60, close: 22 * 60, slot: 120, fee: 1500, approval: true, description: 'Air-conditioned hall with seating for 80, projector and pantry. Ideal for birthdays and small functions.' },
    { name: 'Swimming Pool', slug: 'swimming-pool', location: 'Central Podium', capacity: 25, open: 6 * 60, close: 21 * 60, slot: 60, fee: 0, approval: false, description: 'Semi-Olympic pool with a separate toddler pool. A lifeguard is on duty during all booking slots.' },
    { name: 'Tennis Court', slug: 'tennis-court', location: 'North Lawn', capacity: 4, open: 6 * 60, close: 22 * 60, slot: 60, fee: 200, approval: false, description: 'Synthetic hard court with floodlights. Rackets are available at the society office.' },
    { name: 'Sports Court', slug: 'sports-court', location: 'South Lawn', capacity: 12, open: 6 * 60, close: 22 * 60, slot: 60, fee: 150, approval: false, description: 'Multi-purpose court for badminton, basketball and box cricket.' },
    { name: 'Party Hall', slug: 'party-hall', location: 'Tower A, Terrace', capacity: 120, open: 10 * 60, close: 23 * 60, slot: 180, fee: 2500, approval: true, description: 'Open-air terrace venue with a covered stage. Music must stop by 22:00 as per society rules.' },
    { name: 'Gymnasium', slug: 'gymnasium', location: 'Tower B, Basement', capacity: 20, open: 5 * 60, close: 22 * 60, slot: 60, fee: 0, approval: false, description: 'Fully-equipped gym with cardio and strength sections. A trainer is available on weekday mornings.' },
  ];

  const amenities: Awaited<ReturnType<typeof prisma.amenity.create>>[] = [];
  for (const spec of AMENITY_SPECS) {
    amenities.push(
      await prisma.amenity.create({
        data: {
          societyId: society.id,
          name: spec.name,
          slug: spec.slug,
          description: spec.description,
          location: spec.location,
          capacity: spec.capacity,
          openMinute: spec.open,
          closeMinute: spec.close,
          slotMinutes: spec.slot,
          bookingFee: money(spec.fee),
          maxAdvanceDays: 30,
          minCancelHours: 4,
          maxSlotsPerBooking: spec.slot >= 120 ? 1 : 3,
          requiresApproval: spec.approval,
        },
      }),
    );
  }
  console.log(`  Amenities: ${amenities.length}`);

  // ── Amenity bookings ───────────────────────────────────────────────────────

  let bookingCount = 0;
  const takenSlots = new Set<string>();

  const createBooking = async (
    amenity: (typeof amenities)[number],
    resident: SeededResident,
    startsAt: Date,
    status: BookingStatus,
  ) => {
    const key = `${amenity.id}|${startsAt.toISOString()}|${status}`;
    if (takenSlots.has(key)) return;
    takenSlots.add(key);

    await prisma.amenityBooking.create({
      data: {
        bookingCode: `BK-${randomCode(6)}`,
        amenityId: amenity.id,
        residentId: resident.residentId,
        flatId: resident.flat.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + amenity.slotMinutes * 60_000),
        guestsCount: randomInt(1, Math.min(8, amenity.capacity)),
        purpose: pick(['Family gathering', 'Birthday celebration', 'Practice session', 'Morning workout', 'Weekend game']),
        fee: amenity.bookingFee,
        status,
        cancelledAt: status === BookingStatus.CANCELLED ? hoursAgo(randomInt(2, 40)) : null,
        cancelReason: status === BookingStatus.CANCELLED ? 'Plans changed' : null,
        createdAt: new Date(startsAt.getTime() - randomInt(1, 8) * 86_400_000),
      },
    });
    bookingCount += 1;
  };

  // Past (completed) bookings
  for (let i = 0; i < 26; i += 1) {
    const amenity = pick(amenities);
    const day = daysAgo(randomInt(1, 25));
    const slotIndex = randomInt(0, Math.floor((amenity.closeMinute - amenity.openMinute) / amenity.slotMinutes) - 1);
    const startsAt = new Date(day);
    startsAt.setHours(0, amenity.openMinute + slotIndex * amenity.slotMinutes, 0, 0);
    await createBooking(amenity, pick(residents), startsAt, BookingStatus.COMPLETED);
  }

  // Upcoming bookings, including a couple for the demo resident
  for (let i = 0; i < 18; i += 1) {
    const amenity = pick(amenities);
    const day = daysAhead(randomInt(0, 12));
    const slotIndex = randomInt(0, Math.floor((amenity.closeMinute - amenity.openMinute) / amenity.slotMinutes) - 1);
    const startsAt = new Date(day);
    startsAt.setHours(0, amenity.openMinute + slotIndex * amenity.slotMinutes, 0, 0);
    if (startsAt <= NOW) continue;
    const resident = i < 2 ? demoResident : pick(residents);
    const amenityRequiresApproval = amenity.requiresApproval;
    await createBooking(
      amenity,
      resident,
      startsAt,
      amenityRequiresApproval && chance(0.5) ? BookingStatus.PENDING : BookingStatus.CONFIRMED,
    );
  }

  // A few cancellations
  for (let i = 0; i < 4; i += 1) {
    const amenity = pick(amenities);
    const startsAt = daysAhead(randomInt(1, 10), 18, 0);
    await createBooking(amenity, pick(residents), startsAt, BookingStatus.CANCELLED);
  }
  console.log(`  Amenity bookings: ${bookingCount}`);

  // ── Maintenance bills & payments ───────────────────────────────────────────

  const COMMON_CHARGES: { type: ChargeType; label: string; amount: number }[] = [
    { type: ChargeType.WATER, label: 'Water charges', amount: 420 },
    { type: ChargeType.SECURITY, label: 'Security services', amount: 850 },
    { type: ChargeType.COMMON_ELECTRICITY, label: 'Common area electricity', amount: 560 },
    { type: ChargeType.REPAIRS, label: 'Repairs & upkeep fund', amount: 300 },
    { type: ChargeType.SINKING_FUND, label: 'Sinking fund', amount: 250 },
  ];

  let billCount = 0;
  let paymentCount = 0;
  const residentByFlat = new Map<string, SeededResident>();
  for (const resident of residents) {
    if (!residentByFlat.has(resident.flat.id)) residentByFlat.set(resident.flat.id, resident);
  }

  // Five billing periods: the four previous months plus the current one.
  for (let monthsBack = 4; monthsBack >= 0; monthsBack -= 1) {
    const periodDate = new Date(NOW.getFullYear(), NOW.getMonth() - monthsBack, 1);
    const periodMonth = periodDate.getMonth() + 1;
    const periodYear = periodDate.getFullYear();
    const issueDate = new Date(periodYear, periodMonth - 1, 1, 9, 0, 0);
    const dueDate = new Date(periodYear, periodMonth - 1, 15, 23, 59, 0);
    const isCurrentMonth = monthsBack === 0;

    for (const flat of flats) {
      const resident = residentByFlat.get(flat.id);
      if (!resident) continue; // vacant flats are not billed

      const charges = [
        { type: ChargeType.MAINTENANCE, label: 'Monthly maintenance', amount: flat.maintenance },
        ...COMMON_CHARGES,
      ];
      const baseAmount = charges.reduce((sum, charge) => sum + charge.amount, 0);

      // Older months are mostly settled; the current month is mostly open.
      const paidProbability = isCurrentMonth ? 0.28 : monthsBack === 1 ? 0.82 : 0.96;
      const isPaid = chance(paidProbability);
      const isOverdue = !isPaid && dueDate < NOW;
      const penalty = isOverdue ? Math.round(baseAmount * 0.02) : 0;
      const totalAmount = baseAmount + penalty;

      const bill = await prisma.maintenanceBill.create({
        data: {
          billNumber: `INV-${periodYear}${String(periodMonth).padStart(2, '0')}-${flat.blockName}${flat.flatNumber}`,
          flatId: flat.id,
          periodMonth,
          periodYear,
          issueDate,
          dueDate,
          baseAmount: money(baseAmount),
          penaltyAmount: money(penalty),
          totalAmount: money(totalAmount),
          paidAmount: money(isPaid ? totalAmount : 0),
          status: isPaid ? BillStatus.PAID : isOverdue ? BillStatus.OVERDUE : BillStatus.UNPAID,
          generatedById: admin.id,
          createdAt: issueDate,
          charges: {
            create: [
              ...charges.map((charge) => ({
                chargeType: charge.type,
                label: charge.label,
                amount: money(charge.amount),
              })),
              ...(penalty > 0
                ? [{ chargeType: ChargeType.PENALTY, label: 'Late payment penalty (2%)', amount: money(penalty) }]
                : []),
            ],
          },
        },
      });
      billCount += 1;

      if (isPaid) {
        const paidAt = new Date(
          dueDate.getTime() - randomInt(0, 12) * 86_400_000 + randomInt(0, 20) * 3_600_000,
        );
        await prisma.payment.create({
          data: {
            billId: bill.id,
            residentId: resident.residentId,
            receiptNumber: `RCPT-${periodYear}${String(periodMonth).padStart(2, '0')}-${randomCode(6)}`,
            transactionRef: `TXN${randomCode(10)}`,
            amount: money(totalAmount),
            method: pick([
              PaymentMethod.UPI,
              PaymentMethod.UPI,
              PaymentMethod.NETBANKING,
              PaymentMethod.CARD,
              PaymentMethod.WALLET,
            ]),
            status: PaymentStatus.SUCCESS,
            paidAt: paidAt > NOW ? hoursAgo(6) : paidAt,
            simulated: true,
            gatewayResponse: {
              gateway: 'SIMULATED',
              authCode: randomCode(8),
              note: 'Payment gateway processing is simulated for scope compliance (SRS §1.4).',
            },
            createdAt: paidAt > NOW ? hoursAgo(6) : paidAt,
          },
        });
        paymentCount += 1;
      }
    }
  }
  console.log(`  Bills: ${billCount} · Payments: ${paymentCount}`);

  // ── Complaints ─────────────────────────────────────────────────────────────

  const COMPLAINT_TEMPLATES: {
    category: ComplaintCategory;
    title: string;
    description: string;
    location: string;
    priority: ComplaintPriority;
    dept: StaffDepartment;
  }[] = [
    { category: ComplaintCategory.PLUMBING, title: 'Kitchen sink drain is blocked', description: 'Water is draining very slowly from the kitchen sink and there is a foul smell. It started two days ago and is getting worse. Please send a plumber at the earliest.', location: 'Kitchen', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.PLUMBING },
    { category: ComplaintCategory.PLUMBING, title: 'Bathroom tap leaking continuously', description: 'The wash basin tap in the guest bathroom keeps dripping even when fully closed. There is visible water wastage throughout the day.', location: 'Guest bathroom', priority: ComplaintPriority.LOW, dept: StaffDepartment.PLUMBING },
    { category: ComplaintCategory.ELECTRICAL, title: 'Frequent tripping of main MCB', description: 'The main MCB in the flat trips two or three times every evening when the geyser and air conditioner run together. Requesting an inspection of the load and wiring.', location: 'Entrance distribution box', priority: ComplaintPriority.HIGH, dept: StaffDepartment.ELECTRICAL },
    { category: ComplaintCategory.ELECTRICAL, title: 'Corridor light not working on 4th floor', description: 'Both tube lights in the common corridor outside the lift lobby have been off for a week. The corridor is completely dark after sunset which is unsafe for children and elderly residents.', location: '4th floor lift lobby', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.ELECTRICAL },
    { category: ComplaintCategory.ELEVATOR, title: 'Lift stopping between floors', description: 'Lift number 2 halted between the 3rd and 4th floor twice this week with residents inside. The door took nearly five minutes to open. This is a serious safety concern.', location: 'Tower lift no. 2', priority: ComplaintPriority.CRITICAL, dept: StaffDepartment.ELEVATOR },
    { category: ComplaintCategory.ELEVATOR, title: 'Lift door closing too fast', description: 'The lift door closes within two seconds, which is too quick for elderly residents to enter safely. Please increase the door dwell time.', location: 'Tower lift no. 1', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.ELEVATOR },
    { category: ComplaintCategory.WATER, title: 'No water supply in the morning', description: 'There has been no water supply between 6 AM and 9 AM for the past three days. Other flats on the same line report the same problem. Please check the overhead tank pump.', location: 'Entire flat', priority: ComplaintPriority.HIGH, dept: StaffDepartment.PLUMBING },
    { category: ComplaintCategory.CLEANING, title: 'Garbage not collected from the floor', description: 'The housekeeping staff have not collected the wet waste from our floor for two consecutive days. The bins are overflowing and attracting flies.', location: '2nd floor common area', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.HOUSEKEEPING },
    { category: ComplaintCategory.CLEANING, title: 'Staircase needs deep cleaning', description: 'The staircase between the ground and second floor has accumulated dust and cobwebs. Requesting a deep clean during the next scheduled housekeeping round.', location: 'Staircase, Tower B', priority: ComplaintPriority.LOW, dept: StaffDepartment.HOUSEKEEPING },
    { category: ComplaintCategory.SECURITY, title: 'Unknown vehicle parked in my slot', description: 'A silver hatchback without a society sticker has been parked in my allotted slot since yesterday evening. Requesting the security team to trace and remove it.', location: 'Basement parking', priority: ComplaintPriority.HIGH, dept: StaffDepartment.SECURITY },
    { category: ComplaintCategory.SECURITY, title: 'Gate camera facing the wrong direction', description: 'The CCTV camera at the service gate appears to have shifted and now covers only the wall. Please realign it so the entry is properly recorded.', location: 'Service gate', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.SECURITY },
    { category: ComplaintCategory.CARPENTRY, title: 'Main door lock is jammed', description: 'The deadbolt of the main door is stiff and takes several attempts to lock. Requesting a carpenter to service or replace the lock.', location: 'Main door', priority: ComplaintPriority.HIGH, dept: StaffDepartment.GENERAL },
    { category: ComplaintCategory.PEST_CONTROL, title: 'Cockroach infestation in the kitchen', description: 'Despite regular cleaning we are seeing cockroaches in the kitchen cabinets every night. Requesting the society pest control team to treat the flat and the common duct.', location: 'Kitchen and utility', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.GENERAL },
    { category: ComplaintCategory.OTHER, title: 'Intercom not connecting to the gate', description: 'The intercom handset rings but no audio comes through when the gate calls. We are missing visitor announcements as a result.', location: 'Living room', priority: ComplaintPriority.MEDIUM, dept: StaffDepartment.GENERAL },
    { category: ComplaintCategory.CLEANING, title: 'Terrace drain choked with leaves', description: 'The terrace drain outlet is choked with dry leaves and water is pooling near the water tank. This may cause seepage into the top-floor flats during rain.', location: 'Terrace, Tower C', priority: ComplaintPriority.HIGH, dept: StaffDepartment.HOUSEKEEPING },
  ];

  const staffByDept = new Map<StaffDepartment, (typeof staff)[number]>();
  for (const member of staff) staffByDept.set(member.department, member);

  const RESOLUTION_NOTES = [
    'Replaced the faulty part and tested the fix in the presence of the resident. Working normally now.',
    'Cleared the blockage and cleaned the line. Advised the resident on preventive care.',
    'Serviced the unit and tightened loose connections. Will re-inspect during the next routine round.',
    'Issue traced to the common line. Repaired and verified across affected flats.',
  ];

  const SLA_HOURS: Record<ComplaintPriority, number> = {
    CRITICAL: 4,
    HIGH: 12,
    MEDIUM: 48,
    LOW: 96,
  };

  let complaintCount = 0;
  const complaintDistribution: { status: ComplaintStatus; count: number }[] = [
    { status: ComplaintStatus.PENDING, count: 6 },
    { status: ComplaintStatus.IN_PROGRESS, count: 6 },
    { status: ComplaintStatus.RESOLVED, count: 9 },
    { status: ComplaintStatus.CLOSED, count: 7 },
  ];

  for (const bucket of complaintDistribution) {
    for (let i = 0; i < bucket.count; i += 1) {
      const template = COMPLAINT_TEMPLATES[(complaintCount * 7 + i) % COMPLAINT_TEMPLATES.length];
      // Guarantee the demo resident owns a spread of tickets across statuses.
      const resident = i === 0 ? demoResident : pick(residents);
      const createdAt = hoursAgo(randomInt(2, 30 * 24));
      const slaDueAt = new Date(createdAt.getTime() + SLA_HOURS[template.priority] * 3_600_000);

      const assignee =
        template.dept === StaffDepartment.SECURITY
          ? staffByDept.get(StaffDepartment.GENERAL)!
          : (staffByDept.get(template.dept) ?? staffByDept.get(StaffDepartment.GENERAL)!);

      const isAssigned = bucket.status !== ComplaintStatus.PENDING;
      const assignedAt = isAssigned ? new Date(createdAt.getTime() + randomInt(1, 6) * 3_600_000) : null;
      const isDone = bucket.status === ComplaintStatus.RESOLVED || bucket.status === ComplaintStatus.CLOSED;
      const resolvedAt = isDone
        ? new Date((assignedAt ?? createdAt).getTime() + randomInt(2, 40) * 3_600_000)
        : null;

      const complaint = await prisma.complaint.create({
        data: {
          ticketNumber: `TKT-${createdAt.getFullYear()}-${randomCode(6)}`,
          residentId: resident.residentId,
          flatId: resident.flat.id,
          category: template.category,
          priority: template.priority,
          status: bucket.status,
          title: template.title,
          description: template.description,
          location: template.location,
          assignedStaffId: isAssigned ? assignee.staffId : null,
          assignedAt,
          slaDueAt,
          firstResponseAt: assignedAt,
          resolvedAt,
          closedAt: bucket.status === ComplaintStatus.CLOSED ? new Date((resolvedAt ?? NOW).getTime() + 6 * 3_600_000) : null,
          resolutionNotes: isDone ? pick(RESOLUTION_NOTES) : null,
          satisfaction: bucket.status === ComplaintStatus.CLOSED ? randomInt(3, 5) : null,
          createdAt,
          updates: {
            create: [
              {
                authorId: resident.userId,
                toStatus: ComplaintStatus.PENDING,
                note: 'Ticket raised by the resident through the SmartSociety helpdesk.',
                createdAt,
              },
              ...(isAssigned
                ? [
                    {
                      authorId: admin.id,
                      fromStatus: ComplaintStatus.PENDING,
                      toStatus: ComplaintStatus.IN_PROGRESS,
                      note: `Assigned to ${assignee.name} (${assignee.department.toLowerCase()}). Target response within ${SLA_HOURS[template.priority]} hours.`,
                      createdAt: assignedAt!,
                    },
                  ]
                : []),
              ...(isDone
                ? [
                    {
                      authorId: assignee.userId,
                      fromStatus: ComplaintStatus.IN_PROGRESS,
                      toStatus: ComplaintStatus.RESOLVED,
                      note: 'Work completed and verified on site.',
                      createdAt: resolvedAt!,
                    },
                  ]
                : []),
              ...(bucket.status === ComplaintStatus.CLOSED
                ? [
                    {
                      authorId: admin.id,
                      fromStatus: ComplaintStatus.RESOLVED,
                      toStatus: ComplaintStatus.CLOSED,
                      note: 'Resident confirmed the fix. Ticket closed.',
                      createdAt: new Date((resolvedAt ?? NOW).getTime() + 6 * 3_600_000),
                    },
                  ]
                : []),
            ],
          },
        },
      });
      complaintCount += 1;
      void complaint;
    }
  }
  console.log(`  Complaints: ${complaintCount}`);

  // ── Visitors, gate passes & gate logs ──────────────────────────────────────

  interface SeededVisitor {
    id: string;
    flatId: string;
    name: string;
    vehicleNumber: string | null;
  }

  const visitorName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;

  const makeVisitor = async (
    resident: SeededResident,
    type: VisitorType,
    index: number,
  ): Promise<SeededVisitor> => {
    const company =
      type === VisitorType.DELIVERY
        ? pick(DELIVERY_COMPANIES)
        : type === VisitorType.CAB
          ? pick(CAB_COMPANIES)
          : type === VisitorType.VENDOR
            ? pick(VENDOR_COMPANIES)
            : null;

    const visitor = await prisma.visitor.create({
      data: {
        flatId: resident.flat.id,
        name: visitorName(),
        phone: phoneFor(index + 2000),
        visitorType: type,
        vehicleNumber: type === VisitorType.GUEST || type === VisitorType.CAB ? plate(index + 700) : chance(0.5) ? plate(index + 800) : null,
        company,
        idProofType: type === VisitorType.VENDOR ? 'Aadhaar' : null,
        idProofNumber: type === VisitorType.VENDOR ? `XXXX-XXXX-${randomInt(1000, 9999)}` : null,
      },
    });
    return { id: visitor.id, flatId: visitor.flatId, name: visitor.name, vehicleNumber: visitor.vehicleNumber };
  };

  let passCount = 0;
  let gateLogCount = 0;
  let visitorIndex = 0;

  // 1. Historical traffic — passes already used, visitors entered and left.
  for (let day = 7; day >= 1; day -= 1) {
    const visitsToday = randomInt(6, 11);
    for (let v = 0; v < visitsToday; v += 1) {
      visitorIndex += 1;
      const resident = pick(residents);
      const type = pick([
        VisitorType.GUEST,
        VisitorType.DELIVERY,
        VisitorType.DELIVERY,
        VisitorType.CAB,
        VisitorType.VENDOR,
        VisitorType.SERVICE,
      ]);
      const visitor = await makeVisitor(resident, type, visitorIndex);
      const guard = pick(guards);
      const entryHour = randomInt(8, 20);
      const entryAt = daysAgo(day, entryHour, randomInt(0, 59));
      const exitAt = new Date(entryAt.getTime() + randomInt(15, 210) * 60_000);

      const hasPass = chance(0.65);
      let gatePassId: string | null = null;

      if (hasPass) {
        const validFrom = new Date(entryAt.getTime() - randomInt(1, 5) * 3_600_000);
        const validUntil = new Date(entryAt.getTime() + randomInt(2, 8) * 3_600_000);
        const pass = await prisma.gatePass.create({
          data: {
            passCode: `GP-${randomCode(6)}`,
            gateCode: uniqueGateCode(),
            qrToken: randomCode(32) + randomCode(32),
            visitorId: visitor.id,
            flatId: resident.flat.id,
            residentId: resident.residentId,
            visitorType: type,
            purpose: pick(['Family visit', 'Package delivery', 'Airport drop', 'Appliance servicing', 'Weekend guest']),
            validFrom,
            validUntil,
            status: GatePassStatus.USED,
            maxEntries: 1,
            entriesUsed: 1,
            createdAt: validFrom,
          },
        });
        gatePassId = pass.id;
        passCount += 1;
      }

      await prisma.gateLog.create({
        data: {
          visitorId: visitor.id,
          flatId: resident.flat.id,
          gatePassId,
          guardId: guard.userId,
          gate: pick(GATES),
          verificationMethod: hasPass
            ? chance(0.7)
              ? VerificationMethod.QR_SCAN
              : VerificationMethod.GATE_CODE
            : VerificationMethod.MANUAL,
          status: GateLogStatus.EXITED,
          entryAt,
          exitAt,
          expectedExitAt: new Date(entryAt.getTime() + 4 * 3_600_000),
          vehicleNumber: visitor.vehicleNumber,
          createdAt: entryAt,
        },
      });
      gateLogCount += 1;
    }
  }

  // 2. A handful of visitors currently inside the society.
  for (let i = 0; i < 5; i += 1) {
    visitorIndex += 1;
    const resident = i === 0 ? demoResident : pick(residents);
    const type = pick([VisitorType.GUEST, VisitorType.VENDOR, VisitorType.SERVICE, VisitorType.DELIVERY]);
    const visitor = await makeVisitor(resident, type, visitorIndex);
    const entryAt = hoursAgo(randomInt(1, 5));

    await prisma.gateLog.create({
      data: {
        visitorId: visitor.id,
        flatId: resident.flat.id,
        guardId: guards[0].userId,
        gate: 'Main Gate',
        verificationMethod: VerificationMethod.MANUAL,
        status: GateLogStatus.INSIDE,
        entryAt,
        expectedExitAt: new Date(entryAt.getTime() + 2 * 3_600_000),
        vehicleNumber: visitor.vehicleNumber,
        createdAt: entryAt,
      },
    });
    gateLogCount += 1;
  }

  // 3. One overstaying vendor so the overstay alert has something to show.
  {
    visitorIndex += 1;
    const resident = pick(residents);
    const visitor = await makeVisitor(resident, VisitorType.VENDOR, visitorIndex);
    const entryAt = hoursAgo(7);
    await prisma.gateLog.create({
      data: {
        visitorId: visitor.id,
        flatId: resident.flat.id,
        guardId: guards[1].userId,
        gate: 'Service Gate',
        verificationMethod: VerificationMethod.MANUAL,
        status: GateLogStatus.INSIDE,
        entryAt,
        expectedExitAt: hoursAgo(4),
        remarks: 'Water purifier servicing — expected to take two hours.',
        vehicleNumber: visitor.vehicleNumber,
        createdAt: entryAt,
      },
    });
    gateLogCount += 1;
  }

  // 4. A denied entry, for the security log.
  {
    visitorIndex += 1;
    const resident = pick(residents);
    const visitor = await makeVisitor(resident, VisitorType.OTHER, visitorIndex);
    await prisma.gateLog.create({
      data: {
        visitorId: visitor.id,
        flatId: resident.flat.id,
        guardId: guards[0].userId,
        gate: 'Main Gate',
        verificationMethod: VerificationMethod.MANUAL,
        status: GateLogStatus.DENIED,
        denialReason: 'Resident unreachable on intercom and no pre-approved pass.',
        createdAt: daysAgo(1, 21, 15),
      },
    });
    gateLogCount += 1;
  }

  // 5. Live, unused passes — what a guard sees under "Expected today".
  const upcomingPassSpecs: { resident: SeededResident; type: VisitorType; purpose: string; from: Date; until: Date }[] = [
    { resident: demoResident, type: VisitorType.GUEST, purpose: 'Parents visiting for the weekend', from: hoursAgo(1), until: hoursAhead(10) },
    { resident: demoResident, type: VisitorType.DELIVERY, purpose: 'Furniture delivery', from: startOfToday(), until: hoursAhead(6) },
    { resident: pick(residents), type: VisitorType.CAB, purpose: 'Airport pickup', from: hoursAgo(2), until: hoursAhead(4) },
    { resident: pick(residents), type: VisitorType.VENDOR, purpose: 'AC servicing', from: startOfToday(), until: hoursAhead(8) },
    { resident: pick(residents), type: VisitorType.GUEST, purpose: 'Birthday party guests', from: hoursAhead(2), until: hoursAhead(12) },
    { resident: pick(residents), type: VisitorType.SERVICE, purpose: 'Carpenter for wardrobe fitting', from: daysAhead(1, 10), until: daysAhead(1, 18) },
  ];

  for (const spec of upcomingPassSpecs) {
    visitorIndex += 1;
    const visitor = await makeVisitor(spec.resident, spec.type, visitorIndex);
    await prisma.gatePass.create({
      data: {
        passCode: `GP-${randomCode(6)}`,
        gateCode: uniqueGateCode(),
        qrToken: randomCode(32) + randomCode(32),
        visitorId: visitor.id,
        flatId: spec.resident.flat.id,
        residentId: spec.resident.residentId,
        visitorType: spec.type,
        purpose: spec.purpose,
        validFrom: spec.from,
        validUntil: spec.until,
        status: GatePassStatus.ACTIVE,
        maxEntries: spec.type === VisitorType.VENDOR ? 2 : 1,
        createdAt: hoursAgo(randomInt(2, 20)),
      },
    });
    passCount += 1;
  }

  // 6. One expired and one cancelled pass, so every status is represented.
  {
    visitorIndex += 1;
    const visitor = await makeVisitor(demoResident, VisitorType.DELIVERY, visitorIndex);
    await prisma.gatePass.create({
      data: {
        passCode: `GP-${randomCode(6)}`,
        gateCode: uniqueGateCode(),
        qrToken: randomCode(32) + randomCode(32),
        visitorId: visitor.id,
        flatId: demoResident.flat.id,
        residentId: demoResident.residentId,
        visitorType: VisitorType.DELIVERY,
        purpose: 'Grocery delivery (window elapsed)',
        validFrom: daysAgo(2, 9),
        validUntil: daysAgo(2, 13),
        status: GatePassStatus.EXPIRED,
        createdAt: daysAgo(2, 8),
      },
    });
    passCount += 1;

    visitorIndex += 1;
    const cancelledVisitor = await makeVisitor(demoResident, VisitorType.GUEST, visitorIndex);
    await prisma.gatePass.create({
      data: {
        passCode: `GP-${randomCode(6)}`,
        gateCode: uniqueGateCode(),
        qrToken: randomCode(32) + randomCode(32),
        visitorId: cancelledVisitor.id,
        flatId: demoResident.flat.id,
        residentId: demoResident.residentId,
        visitorType: VisitorType.GUEST,
        purpose: 'Visit postponed',
        validFrom: daysAhead(3, 10),
        validUntil: daysAhead(3, 20),
        status: GatePassStatus.CANCELLED,
        cancelledAt: hoursAgo(20),
        cancelReason: 'Guest rescheduled the trip.',
        createdAt: daysAgo(1, 18),
      },
    });
    passCount += 1;
  }

  console.log(`  Visitors: ${visitorIndex} · Gate passes: ${passCount} · Gate logs: ${gateLogCount}`);

  // ── Notices ────────────────────────────────────────────────────────────────

  const NOTICES: {
    title: string;
    content: string;
    category: NoticeCategory;
    priority: NoticePriority;
    daysAgo: number;
    pinned?: boolean;
    eventInDays?: number;
    eventLocation?: string;
    expiresInDays?: number;
  }[] = [
    {
      title: 'Annual General Body Meeting — 28th of this month',
      content:
        'All members are requested to attend the Annual General Body Meeting to be held in the Clubhouse at 6:00 PM. The agenda includes the audited accounts for the financial year, the revised maintenance structure, the lift modernisation proposal and the election of two managing-committee members.\n\nMembers who cannot attend in person may submit a written proxy at the society office at least 24 hours in advance. Please carry your flat identification.',
      category: NoticeCategory.EVENT,
      priority: NoticePriority.HIGH,
      daysAgo: 3,
      pinned: true,
      eventInDays: 12,
      eventLocation: 'Clubhouse, Tower D',
    },
    {
      title: 'Water tanker schedule revised from Monday',
      content:
        'Due to reduced supply from the municipal line, tanker deliveries will now arrive at 7:00 AM and 5:00 PM instead of a single mid-day delivery. Residents are requested to store water accordingly and report any leakage in common areas immediately through the helpdesk.',
      category: NoticeCategory.MAINTENANCE,
      priority: NoticePriority.NORMAL,
      daysAgo: 6,
      expiresInDays: 20,
    },
    {
      title: 'Lift modernisation work in Tower B — 14th to 17th',
      content:
        'Lift number 2 in Tower B will be out of service for four days for gearbox replacement and door-sensor upgrades. Lift number 1 will remain operational throughout. Residents on higher floors who need assistance should contact the society office in advance.',
      category: NoticeCategory.MAINTENANCE,
      priority: NoticePriority.HIGH,
      daysAgo: 2,
      eventInDays: 5,
      eventLocation: 'Tower B',
    },
    {
      title: 'Maintenance bills for the current month are now available',
      content:
        'Invoices have been generated for all occupied flats and are available under Maintenance Bills in your dashboard. The due date is the 15th. A late-payment penalty of 2% applies to bills that remain unpaid five days after the due date, as approved in the last general body meeting.',
      category: NoticeCategory.FINANCIAL,
      priority: NoticePriority.NORMAL,
      daysAgo: 1,
    },
    {
      title: 'Revised visitor entry policy — QR gate passes mandatory after 10 PM',
      content:
        'To strengthen night-time security, visitors arriving after 10:00 PM will be admitted only against a valid QR gate pass generated by the host resident. Walk-in entries after this hour will require the guard to reach the resident on intercom, which may cause delays.\n\nGenerating a pass takes under a minute from the Visitor Passes section of your dashboard.',
      category: NoticeCategory.SECURITY,
      priority: NoticePriority.HIGH,
      daysAgo: 9,
      pinned: true,
    },
    {
      title: 'Diwali celebration and rangoli competition',
      content:
        'The cultural committee invites all families to the Diwali celebration on the central lawn. The evening will include a rangoli competition (registration at the society office), a children\'s lamp-decoration contest, and community dinner. Please avoid crackers near parked vehicles and the garden area.',
      category: NoticeCategory.EVENT,
      priority: NoticePriority.NORMAL,
      daysAgo: 14,
      eventInDays: 21,
      eventLocation: 'Central Lawn',
    },
    {
      title: 'Society parking rules — reminder',
      content:
        'Each flat is allotted parking as per its registered slot number. Parking in another resident\'s slot or in the visitor bay for more than four hours will attract a warning followed by wheel-locking. Two-wheelers must be parked only in the marked two-wheeler zone.',
      category: NoticeCategory.GUIDELINE,
      priority: NoticePriority.NORMAL,
      daysAgo: 21,
    },
    {
      title: 'Pest control drive across all towers',
      content:
        'A society-wide pest control drive will be carried out over two days, covering common ducts, staircases, the basement and the garbage room. Residents who wish to have their flats treated should register at the society office; the treatment is included in the annual contract.',
      category: NoticeCategory.MAINTENANCE,
      priority: NoticePriority.NORMAL,
      daysAgo: 11,
      eventInDays: 4,
    },
    {
      title: 'Swimming pool closed for cleaning every Monday morning',
      content:
        'The pool will be closed from 6:00 AM to 11:00 AM every Monday for backwashing and chemical balancing. Bookings during this window are automatically blocked in the amenity calendar.',
      category: NoticeCategory.GENERAL,
      priority: NoticePriority.LOW,
      daysAgo: 30,
    },
    {
      title: 'Fire safety drill conducted successfully',
      content:
        'Thank you to the 180+ residents who participated in the fire safety drill last Sunday. The evacuation of all four towers was completed in eleven minutes. Fire extinguishers on every floor have been serviced and the assembly point signage has been refreshed.',
      category: NoticeCategory.SECURITY,
      priority: NoticePriority.LOW,
      daysAgo: 26,
    },
  ];

  for (const notice of NOTICES) {
    await prisma.notice.create({
      data: {
        title: notice.title,
        content: notice.content,
        category: notice.category,
        priority: notice.priority,
        audience: NoticeAudience.ALL,
        publishAt: daysAgo(notice.daysAgo, 10),
        expiresAt: notice.expiresInDays ? daysAhead(notice.expiresInDays) : null,
        eventDate: notice.eventInDays ? daysAhead(notice.eventInDays, 18) : null,
        eventLocation: notice.eventLocation ?? null,
        isPinned: notice.pinned ?? false,
        isPublished: true,
        authorId: chance(0.5) ? admin.id : secretary.id,
        createdAt: daysAgo(notice.daysAgo, 10),
      },
    });
  }
  console.log(`  Notices: ${NOTICES.length}`);

  // ── Polls ──────────────────────────────────────────────────────────────────

  const POLLS: {
    title: string;
    description: string;
    options: string[];
    status: PollStatus;
    startsAgo: number;
    endsIn: number;
    voteShare: number[];
    showLive: boolean;
  }[] = [
    {
      title: 'Should the society install rooftop solar panels?',
      description:
        'The committee has received a proposal to install a 60 kW rooftop solar plant across all four towers. The estimated cost is ₹34 lakh, funded from the sinking fund, with an expected payback of 4.5 years through reduced common-area electricity bills.',
      options: ['Yes — proceed with the installation', 'No — defer for now', 'Need a detailed cost breakdown first'],
      status: PollStatus.ACTIVE,
      startsAgo: 5,
      endsIn: 9,
      voteShare: [0.58, 0.16, 0.26],
      showLive: true,
    },
    {
      title: 'Preferred timing for the weekly deep-cleaning of common areas',
      description:
        'Housekeeping needs a three-hour uninterrupted window each week. Please choose the slot that causes the least disruption for your household.',
      options: ['Tuesday 10 AM – 1 PM', 'Thursday 2 PM – 5 PM', 'Saturday 7 AM – 10 AM'],
      status: PollStatus.ACTIVE,
      startsAgo: 2,
      endsIn: 12,
      voteShare: [0.3, 0.22, 0.48],
      showLive: false,
    },
    {
      title: 'Approve the revised gym equipment purchase',
      description:
        'Proposal to add two treadmills, a rowing machine and a functional trainer to the gymnasium at a cost of ₹6.2 lakh from the amenity fund.',
      options: ['Approve the full proposal', 'Approve only the treadmills', 'Reject'],
      status: PollStatus.CLOSED,
      startsAgo: 40,
      endsIn: -12,
      voteShare: [0.64, 0.24, 0.12],
      showLive: true,
    },
    {
      title: 'Should visitor parking be limited to two hours?',
      description:
        'Draft proposal awaiting committee review before it is opened to residents for voting.',
      options: ['Yes, two hours', 'Yes, but four hours', 'No change needed'],
      status: PollStatus.DRAFT,
      startsAgo: -2,
      endsIn: 20,
      voteShare: [0, 0, 0],
      showLive: false,
    },
  ];

  let voteCount = 0;
  for (const spec of POLLS) {
    const poll = await prisma.poll.create({
      data: {
        title: spec.title,
        description: spec.description,
        status: spec.status,
        startsAt: daysAgo(spec.startsAgo, 9),
        endsAt: daysAhead(spec.endsIn, 21),
        isAnonymous: true,
        showLiveResults: spec.showLive,
        authorId: admin.id,
        createdAt: daysAgo(Math.max(spec.startsAgo, 0) + 1, 9),
        options: {
          create: spec.options.map((label, index) => ({ label, sortOrder: index })),
        },
      },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });

    if (spec.status === PollStatus.DRAFT) continue;

    // Roughly 60–75% turnout, distributed according to voteShare.
    const voters = pickSome(residents, Math.round(residents.length * (spec.status === PollStatus.CLOSED ? 0.75 : 0.6)));
    // Keep the demo resident un-voted on the first active poll so the evaluator
    // can cast a vote themselves.
    const eligible = spec.title.startsWith('Should the society install')
      ? voters.filter((voter) => voter.residentId !== demoResident.residentId)
      : voters;

    for (const [index, voter] of eligible.entries()) {
      const roll = (index % 100) / 100;
      let cumulative = 0;
      let optionIndex = 0;
      for (const [i, share] of spec.voteShare.entries()) {
        cumulative += share;
        if (roll < cumulative) {
          optionIndex = i;
          break;
        }
      }
      await prisma.pollVote.create({
        data: {
          pollId: poll.id,
          optionId: poll.options[optionIndex].id,
          residentId: voter.residentId,
          createdAt: daysAgo(Math.max(spec.startsAgo - randomInt(0, 3), 0), randomInt(8, 22)),
        },
      });
      voteCount += 1;
    }
  }
  console.log(`  Polls: ${POLLS.length} · Votes: ${voteCount}`);

  // ── Emergency alerts (all resolved, so the demo does not open with a siren) ─

  const ALERTS: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    instructions: string;
    startedAgoHours: number;
    durationHours: number;
  }[] = [
    {
      type: AlertType.WATER_SHUTDOWN,
      severity: AlertSeverity.WARNING,
      title: 'Water supply shut down for pump repair',
      message: 'The main pump feeding towers A and B failed this morning. Supply is suspended while the motor is replaced.',
      instructions: 'Store water for essential use. Tankers will run at 2 PM and 6 PM at the service gate.',
      startedAgoHours: 52,
      durationHours: 7,
    },
    {
      type: AlertType.POWER_OUTAGE,
      severity: AlertSeverity.INFO,
      title: 'Scheduled power shutdown by MSEDCL',
      message: 'The distribution company carried out a scheduled shutdown for feeder maintenance. Lifts ran on the DG backup throughout.',
      instructions: 'No action was required from residents.',
      startedAgoHours: 120,
      durationHours: 4,
    },
    {
      type: AlertType.FIRE,
      severity: AlertSeverity.CRITICAL,
      title: 'Fire alarm triggered in Tower C basement',
      message: 'A smoke detector in the basement parking was triggered by a short circuit in a scooter charger. The fire team responded within four minutes.',
      instructions: 'Residents were asked to use the staircases and assemble on the central lawn.',
      startedAgoHours: 400,
      durationHours: 2,
    },
  ];

  for (const alert of ALERTS) {
    await prisma.emergencyAlert.create({
      data: {
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        instructions: alert.instructions,
        status: AlertStatus.RESOLVED,
        sirenEnabled: alert.severity === AlertSeverity.CRITICAL,
        raisedById: admin.id,
        resolvedById: admin.id,
        startedAt: hoursAgo(alert.startedAgoHours),
        resolvedAt: hoursAgo(alert.startedAgoHours - alert.durationHours),
        resolutionNote: 'Situation normalised. Residents informed through the notice board.',
        createdAt: hoursAgo(alert.startedAgoHours),
      },
    });
  }
  console.log(`  Emergency alerts: ${ALERTS.length} (all resolved)`);

  // ── Notifications ──────────────────────────────────────────────────────────

  const demoResidentBill = await prisma.maintenanceBill.findFirst({
    where: { flatId: demoResident.flat.id, status: { in: [BillStatus.UNPAID, BillStatus.OVERDUE] } },
    orderBy: { dueDate: 'desc' },
  });
  const demoResidentComplaint = await prisma.complaint.findFirst({
    where: { residentId: demoResident.residentId },
    orderBy: { createdAt: 'desc' },
  });

  const notifications: Prisma.NotificationCreateManyInput[] = [
    {
      userId: demoResident.userId,
      type: NotificationType.BILL_GENERATED,
      title: 'Your maintenance bill is ready',
      body: demoResidentBill
        ? `Invoice ${demoResidentBill.billNumber} for ₹${demoResidentBill.totalAmount.toString()} is due on ${demoResidentBill.dueDate.toLocaleDateString('en-IN')}.`
        : 'A new maintenance invoice has been generated for your flat.',
      link: '/resident/bills',
      entityType: 'MaintenanceBill',
      entityId: demoResidentBill?.id ?? null,
      createdAt: hoursAgo(20),
    },
    {
      userId: demoResident.userId,
      type: NotificationType.GATE_PASS_CREATED,
      title: 'Visitor pass created',
      body: 'Your gate pass for the weekend guests is active. Share the QR code or the 6-digit gate code with them.',
      link: '/resident/visitors',
      createdAt: hoursAgo(4),
    },
    {
      userId: demoResident.userId,
      type: NotificationType.COMPLAINT_UPDATED,
      title: 'Your ticket has an update',
      body: demoResidentComplaint
        ? `${demoResidentComplaint.ticketNumber}: ${demoResidentComplaint.title}`
        : 'A technician has been assigned to your complaint.',
      link: demoResidentComplaint ? `/resident/complaints/${demoResidentComplaint.id}` : '/resident/complaints',
      entityType: 'Complaint',
      entityId: demoResidentComplaint?.id ?? null,
      readAt: hoursAgo(30),
      createdAt: hoursAgo(34),
    },
    {
      userId: demoResident.userId,
      type: NotificationType.NOTICE_PUBLISHED,
      title: 'New notice: Annual General Body Meeting',
      body: 'The AGM is scheduled in the clubhouse. Please review the agenda.',
      link: '/resident/notices',
      createdAt: daysAgo(3, 10),
    },
    {
      userId: guards[0].userId,
      type: NotificationType.OVERSTAY,
      title: 'Visitor overstay',
      body: 'A vendor at the Service Gate has exceeded the expected exit time by more than three hours.',
      link: '/guard/logs',
      isUrgent: true,
      createdAt: hoursAgo(3),
    },
    {
      userId: guards[0].userId,
      type: NotificationType.GATE_PASS_CREATED,
      title: 'Passes expected today',
      body: 'Six pre-approved visitors are expected at the gate today.',
      link: '/guard/expected',
      createdAt: hoursAgo(9),
    },
    {
      userId: staff[0].userId,
      type: NotificationType.COMPLAINT_ASSIGNED,
      title: 'New ticket assigned to you',
      body: 'A plumbing ticket has been routed to you. Please review the SLA target.',
      link: '/staff/tickets',
      isUrgent: true,
      createdAt: hoursAgo(6),
    },
    {
      userId: staff[0].userId,
      type: NotificationType.SLA_WARNING,
      title: 'SLA deadline approaching',
      body: 'One of your assigned tickets is due within the next four hours.',
      link: '/staff/tickets',
      createdAt: hoursAgo(2),
    },
    {
      userId: admin.id,
      type: NotificationType.COMPLAINT_CREATED,
      title: 'New complaints awaiting assignment',
      body: 'Six helpdesk tickets are pending assignment to maintenance staff.',
      link: '/admin/complaints',
      createdAt: hoursAgo(5),
    },
    {
      userId: admin.id,
      type: NotificationType.BILL_OVERDUE,
      title: 'Overdue maintenance dues',
      body: 'Several flats have bills past the due date. Review the collection report.',
      link: '/admin/bills',
      createdAt: hoursAgo(11),
    },
  ];

  await prisma.notification.createMany({ data: notifications });
  console.log(`  Notifications: ${notifications.length}`);

  // ── Audit log ──────────────────────────────────────────────────────────────

  const auditEntries: Prisma.AuditLogCreateManyInput[] = [
    { userId: admin.id, actorName: admin.fullName, actorRole: Role.ADMIN, action: 'auth.login.success', entityType: 'User', entityId: admin.id, description: `${admin.fullName} signed in as ADMIN.`, ipAddress: '192.168.1.14', createdAt: hoursAgo(3) },
    { userId: admin.id, actorName: admin.fullName, actorRole: Role.ADMIN, action: 'bill.generated', entityType: 'MaintenanceBill', description: `Generated maintenance bills for ${residentByFlat.size} occupied flats.`, metadata: { flats: residentByFlat.size }, ipAddress: '192.168.1.14', createdAt: daysAgo(1, 9) },
    { userId: admin.id, actorName: admin.fullName, actorRole: Role.ADMIN, action: 'notice.created', entityType: 'Notice', description: 'Published notice "Annual General Body Meeting — 28th of this month".', ipAddress: '192.168.1.14', createdAt: daysAgo(3, 10) },
    { userId: secretary.id, actorName: secretary.fullName, actorRole: Role.ADMIN, action: 'complaint.assigned', entityType: 'Complaint', description: 'Assigned an elevator ticket to Prakash More (elevator).', createdAt: hoursAgo(26) },
    { userId: admin.id, actorName: admin.fullName, actorRole: Role.ADMIN, action: 'alert.resolved', entityType: 'EmergencyAlert', description: 'Resolved the water shutdown alert after the pump was replaced.', createdAt: hoursAgo(45) },
    { userId: guards[0].userId, actorName: guards[0].name, actorRole: Role.GUARD, action: 'gate.verification', entityType: 'GatePass', description: 'Verified a QR gate pass and approved entry at the Main Gate.', ipAddress: '192.168.1.51', createdAt: hoursAgo(4) },
    { userId: guards[0].userId, actorName: guards[0].name, actorRole: Role.GUARD, action: 'gate.exit', entityType: 'GateLog', description: 'Recorded a visitor exit at the Main Gate.', ipAddress: '192.168.1.51', createdAt: hoursAgo(2) },
    { userId: guards[1].userId, actorName: guards[1].name, actorRole: Role.GUARD, action: 'visitor.logged', entityType: 'Visitor', description: 'Logged a walk-in vendor at the Service Gate.', createdAt: hoursAgo(7) },
    { userId: demoResident.userId, actorName: demoResident.fullName, actorRole: Role.RESIDENT, action: 'gatepass.created', entityType: 'GatePass', description: 'Created a visitor gate pass for weekend guests.', createdAt: hoursAgo(4) },
    { userId: demoResident.userId, actorName: demoResident.fullName, actorRole: Role.RESIDENT, action: 'payment.simulated', entityType: 'Payment', description: 'Simulated a UPI payment against a maintenance invoice.', createdAt: daysAgo(32, 11) },
    { userId: demoResident.userId, actorName: demoResident.fullName, actorRole: Role.RESIDENT, action: 'booking.created', entityType: 'AmenityBooking', description: 'Booked the Clubhouse for a family gathering.', createdAt: hoursAgo(48) },
    { userId: staff[0].userId, actorName: staff[0].name, actorRole: Role.MAINTENANCE_STAFF, action: 'complaint.status.changed', entityType: 'Complaint', description: 'Moved a plumbing ticket from IN_PROGRESS to RESOLVED.', createdAt: hoursAgo(19) },
    { userId: staff[1].userId, actorName: staff[1].name, actorRole: Role.MAINTENANCE_STAFF, action: 'complaint.note.added', entityType: 'Complaint', description: 'Added a work note about replacing the corridor light fittings.', createdAt: hoursAgo(30) },
    { userId: admin.id, actorName: admin.fullName, actorRole: Role.ADMIN, action: 'poll.created', entityType: 'Poll', description: 'Opened the rooftop solar panel poll for resident voting.', createdAt: daysAgo(5, 9) },
    { userId: admin.id, actorName: admin.fullName, actorRole: Role.ADMIN, action: 'resident.created', entityType: 'ResidentProfile', description: 'Onboarded a new tenant in Tower B.', createdAt: daysAgo(9, 15) },
  ];

  await prisma.auditLog.createMany({ data: auditEntries });
  console.log(`  Audit log entries: ${auditEntries.length}`);

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log(`
──────────────────────────────────────────────────────────────
 Demo accounts

   Administrator      admin@smartsociety.local        ${DEMO_PASSWORDS.admin}
   Resident           resident@smartsociety.local     ${DEMO_PASSWORDS.resident}
   Security Guard     guard@smartsociety.local        ${DEMO_PASSWORDS.guard}
   Maintenance Staff  maintenance@smartsociety.local  ${DEMO_PASSWORDS.maintenance}

 All other seeded accounts use: ${DEMO_PASSWORDS.shared}
──────────────────────────────────────────────────────────────
`);
}

const SOCIETY_GUIDELINES = `## Society Guidelines

These guidelines were adopted by the Managing Committee and apply to all owners, tenants and their guests.

### 1. General conduct
- Maintain silence in common areas between 10:00 PM and 7:00 AM.
- Common corridors, staircases and fire-exit routes must be kept free of footwear racks, cycles and storage.
- Smoking is prohibited in lifts, lobbies, staircases and the basement parking.

### 2. Visitors and security
- Every visitor must be recorded at the gate. Residents are encouraged to pre-approve guests with a QR gate pass.
- Visitors arriving after 10:00 PM are admitted only against a valid gate pass.
- Delivery and cab drivers are permitted up to the tower lobby only, unless the resident approves otherwise.
- Domestic help and drivers must carry the society-issued identity card at all times.

### 3. Parking
- Vehicles must be parked only in the slot allotted to the flat. Visitor bays are limited to four hours.
- Two-wheelers are to be parked in the marked two-wheeler zone.
- Washing of vehicles is permitted only in the designated wash bay to conserve water.

### 4. Maintenance dues
- Maintenance invoices are issued on the 1st of every month and are due by the 15th.
- A late-payment penalty of 2% of the invoice value applies after a five-day grace period.
- Receipts for all payments are available for download from the resident dashboard.

### 5. Amenities
- Amenities may be booked up to 30 days in advance through the resident dashboard.
- The Clubhouse and Party Hall require committee approval and carry a usage fee.
- Bookings can be cancelled free of charge up to four hours before the slot begins.
- Children under 12 must be accompanied by an adult at the swimming pool and gymnasium.

### 6. Waste management
- Segregate wet and dry waste. Collection happens twice daily from every floor.
- Construction debris must be removed by the resident's contractor on the same day.

### 7. Renovation and interior work
- Written intimation to the society office is required before any interior work begins.
- Work is permitted between 9:00 AM and 6:00 PM on weekdays and Saturdays only. No work on Sundays or public holidays.
- Structural changes to load-bearing elements are strictly prohibited.

### 8. Pets
- Pets are welcome but must be leashed in all common areas.
- Owners are responsible for cleaning up after their pets.
- Pets are not permitted in the swimming pool area, gymnasium or the children's play zone.

### 9. Complaints and helpdesk
- Raise maintenance issues through the helpdesk so they can be tracked against a service-level target.
- Critical issues (lift entrapment, fire, major water leakage) should additionally be reported to the gate on the emergency number.

### 10. Emergency procedure
- On hearing the fire alarm, use the staircase — never the lift — and assemble on the central lawn.
- Emergency contact numbers are listed in the Emergency Contacts directory of your dashboard.
`;

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('\nSeeding failed:\n', error);
    await prisma.$disconnect();
    process.exit(1);
  });
