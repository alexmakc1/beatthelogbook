import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Modal,
} from 'react-native';
import { COLORS } from '../../../../services/colors';
import { Ionicons } from '@expo/vector-icons';

interface UsageBarChartProps {
  data: {
    date: string;
    total: number;
    count: number;
  }[];
  trackingMode: 'mg' | 'frequency';
  dailyGoal: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const UsageBarChart: React.FC<UsageBarChartProps> = ({ data, trackingMode, dailyGoal }) => {
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No usage data available</Text>
      </View>
    );
  }

  // Calculate the maximum value for scaling
  const maxValue = Math.max(
    ...data.map(item => (trackingMode === 'mg' ? item.total : item.count)),
    dailyGoal
  );

  // Calculate bar width based on number of bars
  const barWidth = Math.min(30, (SCREEN_WIDTH - 60) / data.length - 8);
  
  const handleBarPress = (index: number) => {
    setSelectedBar(index);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Goal Line */}
        <View
          style={[
            styles.goalLine,
            {
              bottom: (dailyGoal / maxValue) * (styles.container.height - 50),
            },
          ]}
        />
        <Text
          style={[
            styles.goalText,
            {
              bottom: (dailyGoal / maxValue) * (styles.container.height - 50) + 15,
            },
          ]}
        >
          Goal: {dailyGoal} {trackingMode === 'mg' ? 'mg' : 'times'}
        </Text>

        {/* Bars */}
        {data.map((item, index) => {
          const value = trackingMode === 'mg' ? item.total : item.count;
          const barHeight = Math.max(5, (value / maxValue) * (styles.container.height - 50));
          const isOverGoal = value > dailyGoal;

          return (
            <TouchableOpacity
              key={index}
              style={styles.barContainer}
              onPress={() => handleBarPress(index)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor: isOverGoal ? COLORS.error : COLORS.primary,
                  },
                ]}
              />
              <Text style={styles.dateText}>{item.date}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          {selectedBar !== null && (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{data[selectedBar].date} Details</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalDetail}>
                <Text style={styles.modalLabel}>Total Usage:</Text>
                <Text style={styles.modalValue}>{data[selectedBar].total} mg</Text>
              </View>
              <View style={styles.modalDetail}>
                <Text style={styles.modalLabel}>Number of Times:</Text>
                <Text style={styles.modalValue}>{data[selectedBar].count} times</Text>
              </View>
              <View style={styles.modalDetail}>
                <Text style={styles.modalLabel}>Daily Goal:</Text>
                <Text style={styles.modalValue}>
                  {dailyGoal} {trackingMode === 'mg' ? 'mg' : 'times'}
                </Text>
              </View>
              <View style={styles.modalDetail}>
                <Text style={styles.modalLabel}>
                  {data[selectedBar].total > dailyGoal ? 'Over Goal:' : 'Under Goal:'}
                </Text>
                <Text 
                  style={[
                    styles.modalValue, 
                    {
                      color: data[selectedBar].total > dailyGoal ? 
                        COLORS.error : 
                        COLORS.success
                    }
                  ]}
                >
                  {Math.abs(data[selectedBar].total - dailyGoal)} {trackingMode === 'mg' ? 'mg' : 'times'}
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  scrollContainer: {
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingBottom: 20,
    height: '100%',
    paddingTop: 20,
  },
  barContainer: {
    alignItems: 'center',
    marginHorizontal: 3,
    height: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  dateText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  goalLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    backgroundColor: COLORS.accent,
    zIndex: 1,
  },
  goalText: {
    position: 'absolute',
    left: 10,
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  emptyContainer: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  modalLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  modalValue: {
    fontWeight: 'bold',
    color: COLORS.text,
    fontSize: 14,
  },
  chartLoading: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default UsageBarChart; 