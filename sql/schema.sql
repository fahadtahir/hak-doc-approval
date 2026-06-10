-- HAK Engineering Document Approval System



-- ─────────────────────────────────────────────
-- Table: users
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100)  NOT NULL,
  email      VARCHAR(150)  NOT NULL UNIQUE,
  department VARCHAR(100)  NOT NULL,
  created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Pre-filled demo users.
INSERT INTO users (name, email, department) VALUES
  ('Ahmed Al-Rashidi',   'ahmed@hakeng.sa',    'Engineering'),
  ('Sara Al-Otaibi',     'sara@hakeng.sa',     'Finance'),
  ('Mohammed Al-Zahrani','mohammed@hakeng.sa',  'Legal'),
  ('Fatima Al-Ghamdi',   'fatima@hakeng.sa',   'Operations'),
  ('Khalid Al-Harbi',    'khalid@hakeng.sa',   'Management'),
  ('Nora Al-Shehri',     'nora@hakeng.sa',     'HR');

-- ─────────────────────────────────────────────
-- Table: document_requests
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_requests (
  id               INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  title            VARCHAR(255)    NOT NULL,
  request_type     ENUM(
                     'Internal Approval',
                     'Client Submission',
                     'Contract Review',
                     'Signature Request'
                   )               NOT NULL,
  requested_by_user_id INT UNSIGNED  NOT NULL,
  department       VARCHAR(100)    NOT NULL,
  priority         ENUM('Low','Medium','High') NOT NULL DEFAULT 'Medium',
  due_date         DATE            NULL,
  external_party_name  VARCHAR(150) NULL,
  external_party_contact VARCHAR(150) NULL,
  pdf_filename     VARCHAR(255)    NULL,
  pdf_original_name VARCHAR(255)   NULL,
  status           ENUM(
                     'Pending Approval',
                     'Approved',
                     'Rejected'
                   )               NOT NULL DEFAULT 'Pending Approval',
  remarks          TEXT            NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP
                                   ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_request_requester
    FOREIGN KEY (requested_by_user_id)
    REFERENCES users(id)
) ENGINE=InnoDB;

-- ─────────────────────────────────────────────
-- Table: approvers
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approvers (
  id                  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  document_request_id INT UNSIGNED  NOT NULL,
  user_id             INT UNSIGNED  NOT NULL,
  role                ENUM('Reviewer','Approver','Signatory') NOT NULL DEFAULT 'Approver',
  sequence            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status              ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  comments            TEXT          NULL,
  action_date         DATETIME      NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_approver_request
    FOREIGN KEY (document_request_id)
    REFERENCES document_requests(id),
  CONSTRAINT fk_approver_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
) ENGINE=InnoDB;
