import bcrypt from 'bcryptjs';

const password = 'password123';
const hash = await bcrypt.hash(password, 10);

console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nUpdate seed.sql with this hash value.');
