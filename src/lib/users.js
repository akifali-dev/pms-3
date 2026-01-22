import { roles } from "@/lib/roles";

export const users = [
  {
    email: "ceo@pms.test",
    password: "pms123",
    name: "Avery Chen",
    role: roles.CEO,
  },
  {
    email: "pm@pms.test",
    password: "pms123",
    name: "Jordan Lee",
    role: roles.PM,
  },
  {
    email: "cto@pms.test",
    password: "pms123",
    name: "Morgan Riley",
    role: roles.CTO,
  },
  {
    email: "senior@pms.test",
    password: "pms123",
    name: "Sam Patel",
    role: roles.SENIOR_DEV,
  },
  {
    email: "dev@pms.test",
    password: "pms123",
    name: "Taylor Nguyen",
    role: roles.DEV,
  },
];

export function findUserByCredentials({ email, password }) {
  return (
    users.find(
      (user) =>
        user.email.toLowerCase() === email.toLowerCase().trim() &&
        user.password === password
    ) ?? null
  );
}
