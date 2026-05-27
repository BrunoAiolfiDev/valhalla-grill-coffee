import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type SavedAddress = {
  line1: string;
  city: string;
  eircode: string;
};

export type CustomerProfile = {
  displayName: string;
  phone?: string;
  savedAddress?: SavedAddress;
};

const profileDoc = (uid: string) => doc(db, "clientes", uid);

export async function getCustomerProfile(
  uid: string,
): Promise<CustomerProfile | null> {
  const snap = await getDoc(profileDoc(uid));
  if (!snap.exists()) return null;
  return snap.data() as CustomerProfile;
}

export async function setCustomerProfile(
  uid: string,
  data: Partial<CustomerProfile>,
): Promise<void> {
  await setDoc(profileDoc(uid), data, { merge: true });
}

export function listenCustomerProfile(
  uid: string,
  callback: (profile: CustomerProfile | null) => void,
) {
  return onSnapshot(profileDoc(uid), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.data() as CustomerProfile);
  });
}

export type CustomerWithUid = CustomerProfile & { uid: string };

export async function getAllCustomers(): Promise<CustomerWithUid[]> {
  const snap = await getDocs(collection(db, "clientes"));
  return snap.docs.map((d) => ({
    uid: d.id,
    ...(d.data() as CustomerProfile),
  }));
}
