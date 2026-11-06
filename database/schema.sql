CREATE DATABASE IF NOT EXISTS online_quiz_system
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE online_quiz_system;

CREATE TABLE IF NOT EXISTS admins (
    admin_id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    PRIMARY KEY (admin_id),
    UNIQUE KEY uq_admins_username (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS questions (
    question_id INT NOT NULL AUTO_INCREMENT,
    question_text TEXT NOT NULL,
    option_a VARCHAR(500) NOT NULL,
    option_b VARCHAR(500) NOT NULL,
    option_c VARCHAR(500) NOT NULL,
    option_d VARCHAR(500) NOT NULL,
    correct_option CHAR(1) NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (question_id),
    CONSTRAINT chk_questions_correct_option
        CHECK (correct_option IN ('A', 'B', 'C', 'D'))
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS quiz_attempts (
    attempt_id INT NOT NULL AUTO_INCREMENT,
    participant_name VARCHAR(100) NOT NULL,
    score INT NOT NULL DEFAULT 0,
    total_questions INT NOT NULL,
    submitted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (attempt_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS responses (
    response_id INT NOT NULL AUTO_INCREMENT,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_option CHAR(1) NOT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (response_id),
    UNIQUE KEY uq_responses_attempt_question (attempt_id, question_id),
    KEY idx_responses_question_id (question_id),
    CONSTRAINT chk_responses_selected_option
        CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    CONSTRAINT fk_responses_attempt
        FOREIGN KEY (attempt_id) REFERENCES quiz_attempts (attempt_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_responses_question
        FOREIGN KEY (question_id) REFERENCES questions (question_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;
