import React, { useMemo } from 'react';

interface ContactSlideProps {
  name: string;
  email: string;
  phone: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: 8,
  color: 'var(--fontcolor)',
  marginBottom: 2,
  display: 'block'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 6,
  border: '1px solid var(--base-grey-light)',
  fontSize: 14,
  outline: 'none'
};

const fieldWrapper: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column'
};

const ContactSlide: React.FC<ContactSlideProps> = ({ name, email, phone, onChange }) => {
  const isValidEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ''), [email]);
  const isValidPhone = useMemo(() => {
    const digits = (phone || '').replace(/\D/g, '');
    return digits.length >= 7; // simple validity rule
  }, [phone]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '20px',
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      flex: 1 // Add flex: 1 to make it stretch
    }}>
      <h2 style={{ margin: 0, color: 'var(--headlinecolor)' }}>Kontaktangaben</h2>
      <p style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 14 }}>
        Bitte geben Sie Ihre Kontaktdaten an, damit wir Ihnen das Angebot zusenden können.
      </p>

      <div style={fieldWrapper}>
        <label style={labelStyle}>Name</label>
        <input
          name="name"
          type="text"
          placeholder="Vorname Nachname"
          value={name || ''}
          onChange={onChange}
          style={inputStyle}
        />
      </div>

      <div style={fieldWrapper}>
        <label style={labelStyle}>E-mail Adresse</label>
        <input
          name="email"
          type="email"
          placeholder="max.mustermann@mustermail.de"
          value={email || ''}
          onChange={onChange}
          style={{
            ...inputStyle,
            border: email ? (isValidEmail ? '1px solid var(--base-grey-light)' : '1px solid #dc3545') : '1px solid var(--base-grey-light)'
          }}
        />
      </div>

      <div style={fieldWrapper}>
        <label style={labelStyle}>Telefonnummer</label>
        <input
          name="phone"
          type="tel"
          placeholder="0179 1234567"
          value={phone || ''}
          onChange={onChange}
          style={{
            ...inputStyle,
            border: phone ? (isValidPhone ? '1px solid var(--base-grey-light)' : '1px solid #dc3545') : '1px solid var(--base-grey-light)'
          }}
        />
      </div>
    </div>
  );
};

export default ContactSlide;
