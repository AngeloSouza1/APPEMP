import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  title?: string;
};

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const parseBrDate = (value: string) => {
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!br) return null;
  const [, dd, mm, yyyy] = br.map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  if (date.getFullYear() !== yyyy || date.getMonth() !== mm - 1 || date.getDate() !== dd) return null;
  return date;
};

const formatBrDate = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const sameDay = (a: Date, b: Date) =>
  a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

export default function DatePickerModal({ visible, value, onChange, onClose, title = 'Selecionar data' }: Props) {
  const selectedDate = useMemo(() => parseBrDate(value) || new Date(), [value]);
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  useEffect(() => {
    if (!visible) return;
    setViewYear(selectedDate.getFullYear());
    setViewMonth(selectedDate.getMonth());
  }, [visible, selectedDate]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const totalCells = 42;
  const monthLabel = `${MESES[viewMonth]} ${viewYear}`;

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstWeekday + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    if (!inMonth) return { key: `empty-${index}`, inMonth: false as const, day: 0 };
    return { key: `day-${day}`, inMonth: true as const, day };
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((prev) => prev - 1);
      return;
    }
    setViewMonth((prev) => prev - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((prev) => prev + 1);
      return;
    }
    setViewMonth((prev) => prev + 1);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.monthNav}>
            <Pressable style={styles.navBtn} onPress={prevMonth}>
              <Text style={styles.navBtnText}>{'<'}</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Pressable style={styles.navBtn} onPress={nextMonth}>
              <Text style={styles.navBtnText}>{'>'}</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {DIAS.map((dia, idx) => (
              <Text key={`${dia}-${idx}`} style={styles.weekDay}>
                {dia}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((cell) => {
              if (!cell.inMonth) {
                return <View key={cell.key} style={styles.cell} />;
              }

              const current = new Date(viewYear, viewMonth, cell.day);
              const selected = sameDay(current, selectedDate);
              return (
                <Pressable
                  key={cell.key}
                  style={[styles.cell, styles.dayCell, selected && styles.dayCellSelected]}
                  onPress={() => {
                    onChange(formatBrDate(current));
                    onClose();
                  }}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{cell.day}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#fff',
    padding: 12,
    gap: 10,
  },
  title: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 16,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: {
    color: '#1d4ed8',
    fontWeight: '800',
    fontSize: 16,
    lineHeight: 18,
  },
  monthLabel: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekDay: {
    flex: 1,
    textAlign: 'center',
    color: '#64748b',
    fontWeight: '700',
    fontSize: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.2857%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: '#2563eb',
  },
  dayText: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
});
