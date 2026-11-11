CREATE TABLE IF NOT EXISTS enquiry_rate (
  ip_hash TEXT NOT NULL,
  hour INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (ip_hash, hour)
);
