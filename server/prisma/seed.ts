import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Note: No default admin user created for security reasons
  // Create your first admin user through the admin panel or API

  // Create sample hotspots in NYC area
  const hotspot1 = await prisma.hotspot.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      title: 'Central Park Treasure',
      description: 'Find the hidden bench near Bethesda Fountain. Look for the brass plaque with a riddle. Solve it to claim your prize!',
      lat: 40.7711,
      lng: -73.9747,
      prize: 'Free coffee at Central Perk Cafe',
      startDate: new Date('2025-01-01T09:00:00Z'),
      endDate: new Date('2025-12-31T18:00:00Z'),
      active: true,
    },
  });

  const hotspot2 = await prisma.hotspot.upsert({
    where: { id: '2' },
    update: {},
    create: {
      id: '2',
      title: 'Brooklyn Bridge Mystery',
      description: 'Walk to the center of Brooklyn Bridge. Count the number of lampposts on the Manhattan side. The answer is your clue!',
      lat: 40.7061,
      lng: -73.9969,
      prize: '$10 gift card',
      startDate: new Date('2025-01-15T10:00:00Z'),
      endDate: new Date('2025-06-30T20:00:00Z'),
      active: true,
    },
  });

  const hotspot3 = await prisma.hotspot.upsert({
    where: { id: '3' },
    update: {},
    create: {
      id: '3',
      title: 'Times Square Challenge',
      description: 'Find the red stairs at Times Square. Take a photo with the costumed characters. Show it at the info booth to win!',
      lat: 40.758,
      lng: -73.9855,
      prize: 'Broadway show tickets discount',
      startDate: new Date('2024-12-01T08:00:00Z'),
      endDate: new Date('2024-12-31T23:59:59Z'),
      active: false, // This one is expired
    },
  });

  console.log('✅ Created sample hotspots');
  console.log(`   - ${hotspot1.title}`);
  console.log(`   - ${hotspot2.title}`);
  console.log(`   - ${hotspot3.title}`);
  
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📋 Next steps:');
  console.log('   - Create your first admin user through the admin panel');
  console.log('   - Or use the API to create admin users');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

