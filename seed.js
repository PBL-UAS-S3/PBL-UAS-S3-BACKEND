const bcrypt = require('bcrypt');
const db = require('./db');

async function seed() {
  const passwordManager = await bcrypt.hash('manager123', 10);
  const passwordStaff = await bcrypt.hash('staff123', 10);

  await db.query(
    'insert into users (nama, email, password, role) values (?, ?, ?, ?), (?, ?, ?, ?)',
    ['Manager Gudang', 'manager@warehouse.com', passwordManager, 'manager',
     'Staf Gudang', 'staff@warehouse.com', passwordStaff, 'staff']
  );

  console.log('Seed berhasil!');
  process.exit();
}

seed();