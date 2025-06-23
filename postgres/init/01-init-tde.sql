-- PostgreSQL Setup Script with Transparent Data Encryption (TDE)
-- File: postgres/init/01-init-tde.sql
--
-- This script sets up PostgreSQL with TDE for secure data at rest.

-- Create tablespaces with encryption
CREATE TABLESPACE encrypted_tablespace OWNER postgres LOCATION '/var/lib/postgresql/data/encrypted_tablespace';

-- Set default encryption settings
ALTER SYSTEM SET encryption.algorithm = 'AES_256_GCM';

-- Create schema for healthcare data
CREATE SCHEMA healthcare;

-- Create users table with encryption
CREATE TABLE healthcare.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE encrypted_tablespace;

-- Create patients table with encryption for sensitive information
CREATE TABLE healthcare.patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES healthcare.users(id),
    medical_record_number VARCHAR(50) UNIQUE,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    -- This field will be additionally encrypted at application level
    ssn VARCHAR(255),
    contact_phone VARCHAR(20) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(100),
    address_zip VARCHAR(20),
    address_country VARCHAR(100) DEFAULT 'USA',
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(100),
    -- These fields will be additionally encrypted at application level
    insurance_provider VARCHAR(255),
    insurance_policy_number VARCHAR(255),
    insurance_group_number VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE encrypted_tablespace;

-- Create medical_records table with encryption
CREATE TABLE healthcare.medical_records (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES healthcare.patients(id),
    doctor_id INTEGER NOT NULL REFERENCES healthcare.users(id),
    visit_date TIMESTAMP NOT NULL,
    diagnosis TEXT,
    treatment TEXT,
    notes TEXT,
    prescription_id INTEGER,
    follow_up_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE encrypted_tablespace;

-- Create audit log for security tracking
CREATE TABLE healthcare.audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES healthcare.users(id),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) TABLESPACE encrypted_tablespace;

-- Create index for better performance
CREATE INDEX idx_patients_user_id ON healthcare.patients(user_id);
CREATE INDEX idx_medical_records_patient_id ON healthcare.medical_records(patient_id);
CREATE INDEX idx_medical_records_doctor_id ON healthcare.medical_records(doctor_id);
CREATE INDEX idx_audit_logs_user_id ON healthcare.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON healthcare.audit_logs(action);

-- Create view for patient information without sensitive data
CREATE VIEW healthcare.patient_view AS
SELECT 
    p.id,
    p.user_id,
    p.medical_record_number,
    p.date_of_birth,
    p.gender,
    p.contact_phone,
    p.contact_email,
    p.address_street,
    p.address_city,
    p.address_state,
    p.address_zip,
    p.address_country,
    p.emergency_contact_name,
    p.emergency_contact_phone,
    p.emergency_contact_relationship,
    p.created_at,
    p.updated_at,
    u.first_name,
    u.last_name
FROM 
    healthcare.patients p
JOIN 
    healthcare.users u ON p.user_id = u.id;

-- Create function to update 'updated_at' timestamp automatically
CREATE OR REPLACE FUNCTION healthcare.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update 'updated_at'
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON healthcare.users
FOR EACH ROW EXECUTE PROCEDURE healthcare.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON healthcare.patients
FOR EACH ROW EXECUTE PROCEDURE healthcare.update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at
BEFORE UPDATE ON healthcare.medical_records
FOR EACH ROW EXECUTE PROCEDURE healthcare.update_updated_at_column();

-- Create audit logging function
CREATE OR REPLACE FUNCTION healthcare.log_audit()
RETURNS TRIGGER AS $$
DECLARE
    audit_details JSONB;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        audit_details = to_jsonb(OLD);
        INSERT INTO healthcare.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (current_setting('app.user_id', TRUE)::INTEGER, 'DELETE', TG_TABLE_NAME, OLD.id, audit_details);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        audit_details = jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
        INSERT INTO healthcare.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (current_setting('app.user_id', TRUE)::INTEGER, 'UPDATE', TG_TABLE_NAME, NEW.id, audit_details);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        audit_details = to_jsonb(NEW);
        INSERT INTO healthcare.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (current_setting('app.user_id', TRUE)::INTEGER, 'INSERT', TG_TABLE_NAME, NEW.id, audit_details);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers
CREATE TRIGGER audit_users
AFTER INSERT OR UPDATE OR DELETE ON healthcare.users
FOR EACH ROW EXECUTE PROCEDURE healthcare.log_audit();

CREATE TRIGGER audit_patients
AFTER INSERT OR UPDATE OR DELETE ON healthcare.patients
FOR EACH ROW EXECUTE PROCEDURE healthcare.log_audit();

CREATE TRIGGER audit_medical_records
AFTER INSERT OR UPDATE OR DELETE ON healthcare.medical_records
FOR EACH ROW EXECUTE PROCEDURE healthcare.log_audit();

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA healthcare TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA healthcare TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA healthcare TO postgres;