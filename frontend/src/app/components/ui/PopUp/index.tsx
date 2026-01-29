import React, { useState } from 'react';
import ClosingButton from '../ClosingButton';

interface PopUpProps {
  content: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  children?: React.ReactElement;
  isOpen?: boolean;
  onClose?: () => void;
}

const PopUp: React.FC<PopUpProps> = ({ content, size = 'medium', children, isOpen: controlledIsOpen, onClose: controlledOnClose }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isControlled) {
      setInternalIsOpen(true);
    }
  };

  const handleClose = () => {
    if (isControlled) {
      controlledOnClose?.();
    } else {
      setInternalIsOpen(false);
    }
  };

  const trigger = !isControlled && (children ? (
    React.cloneElement(children, {
      onClick: handleOpen,
      style: { ...children.props.style, cursor: 'pointer' },
    })
  ) : (
    <button
      onClick={handleOpen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        border: '1px solid #666',
        backgroundColor: 'transparent',
        color: '#666',
        fontSize: '9px',
        fontWeight: '400',
        cursor: 'pointer',
        marginLeft: '6px',
        padding: 0,
        lineHeight: 1,
        verticalAlign: 'middle',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--base-col2)';
        e.currentTarget.style.color = 'var(--base-col2)';
        e.currentTarget.style.backgroundColor = '#ddd';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#666';
        e.currentTarget.style.color = '#666';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title="Mehr Informationen"
    >
      ?
    </button>
  ));

  return (
    <>
      {trigger}
      {isOpen && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: size === 'small' ? '60%' : size === 'large' ? '90%' : '80%',
              height: size === 'small' ? '60%' : size === 'large' ? '90%' : '80%',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backgroundColor: 'var(--foreground)',
              border: '2px solid var(--bordercolor)',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Close button - fixed at top right, always visible */}
            <ClosingButton onClick={handleClose} />

            {/* Content - scrollable */}
            <div style={{ 
              overflow: 'auto', 
              padding: '24px',
              paddingTop: '24px',
              flex: 1,
              minHeight: 0,
              textAlign: 'left'
            }}>
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PopUp;

