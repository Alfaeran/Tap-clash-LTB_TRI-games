export interface School {
  id: string;
  name: string;
  detail: string;
  category: "SMA" | "SMP";
}

export const SCHOOL_LIST: School[] = [
  // SMA (24 Teams)
  { id: "SMA-1", name: "MAN 2", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-2", name: "SMAN 1", detail: "SEYEGAN", category: "SMA" },
  { id: "SMA-3", name: "SMAN 4", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-4", name: "SMKN 2", detail: "KLATEN", category: "SMA" },
  { id: "SMA-5", name: "SMKN 2", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-6", name: "SMA ISLAM", detail: "AL AZHAR 9", category: "SMA" },
  { id: "SMA-7", name: "SMAN 8", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-8", name: "SMAN 10", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-9", name: "SMAN 3", detail: "KLATEN", category: "SMA" },
  { id: "SMA-10", name: "SMAN 7", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-11", name: "SMKN 2", detail: "DEPOK SLEMAN", category: "SMA" },
  { id: "SMA-12", name: "SMKN 4", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-13", name: "SMA BOPKRI 1", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-14", name: "SMAM 3", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-15", name: "SMAN 1", detail: "GODEAN", category: "SMA" },
  { id: "SMA-16", name: "SMKN 1", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-17", name: "SMAN 6", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-18", name: "SMAN 1", detail: "GAMPING SLEMAN", category: "SMA" },
  { id: "SMA-19", name: "SMAN 1", detail: "WATES", category: "SMA" },
  { id: "SMA-20", name: "SMAN 1", detail: "TANJUNGSARI", category: "SMA" },
  { id: "SMA-21", name: "SMK SMTI", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-22", name: "SMKN 3", detail: "YOGYAKARTA", category: "SMA" },
  { id: "SMA-23", name: "SMK PENERBANGAN", detail: "AAG", category: "SMA" },
  { id: "SMA-24", name: "SMA ALI MAKSUM", detail: "BANTUL", category: "SMA" },

  // SMP (8 Teams)
  { id: "SMP-1", name: "SMPN 7", detail: "YOGYAKARTA", category: "SMP" },
  { id: "SMP-2", name: "SMPN 16", detail: "YOGYAKARTA", category: "SMP" },
  { id: "SMP-3", name: "SMP IT", detail: "ALAM NURUL ISLAM", category: "SMP" },
  { id: "SMP-4", name: "SMPN 13", detail: "YOGYAKARTA", category: "SMP" },
  { id: "SMP-5", name: "SMP JOANNES BOSCO", detail: "YOGYAKARTA", category: "SMP" },
  { id: "SMP-6", name: "SMPN 5", detail: "YOGYAKARTA", category: "SMP" },
  { id: "SMP-7", name: "SMPN 8", detail: "YOGYAKARTA", category: "SMP" },
  { id: "SMP-8", name: "SMPM 8", detail: "YOGYAKARTA", category: "SMP" }
];
