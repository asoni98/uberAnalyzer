<template>
  <div class="dashboard-editor-container">
    <button class="dashboard-text" v-on:click="getAllDriverData">Request data</button>
    <button class="dashboard-text" v-on:click="displayData">Display Data</button>

    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1> Below is All Your Uber Driver Data Analyzed: (Click Request Data then Display Data to see it below) </h1>

      <p> Total Amount Riders Paid Excluding Tips: ${{Number((sumRiderTotalData).toFixed(1))}}</p>
      <p> Total Amount You've Made Excluding Tips: ${{Number((sumDriverTotalData).toFixed(1))}} </p>
      <p> Total Amount Uber Made Off Your Trips: ${{Number((sumUberTotalData).toFixed(1))}} </p>
      <p> Total Amount Others Made Off Your Trips (state governments): ${{Number((sumOtherTotalData).toFixed(1))}} </p>

      <p> Your Total Share (%) of all Rider's Payments: {{Number((computeDriverShareTotalData).toFixed(4)) * 100}} </p>
      <p> Your Average Share of a Trip: {{Number((computeDriverShareByTripData.average).toFixed(4)) * 100}}</p>

      <p> Uber's Total Share (%) of all Rider's Payments {{Number((computeUberShareTotalData).toFixed(4) * 100)}}</p>
      <p> Uber's Average Share of a Trip: {{Number((computeUberShareByTripData.average).toFixed(4))*100}} </p>

      <p> Other's Total Share (%) of all Rider's Payments {{Number((computeOtherShareTotalData).toFixed(4)) * 100}}</p>
      <p> Others's Average Share of a Trip: {{Number((computeOtherShareByTripData.average).toFixed(4)) * 100}} </p>
    </el-row>

    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1>Uber Take Rate By Trip Length In Miles</h1>
      <line-chart :chart-data="uberTakeRateByLengthData" :lineName="'Take Rates'"/>
    </el-row>
    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1>Average Profit Per Trip By Hours Worked Per Week </h1>
      <line-chart :chart-data="averageProfitByTripLengthData" :lineName="'Average Profit Per Trip By Hours Worked Per Week'"/>
    </el-row>
    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1>Average Profit Made By Time Day By Trip Length in Miles (Morning) </h1>
      <line-chart :chart-data="morningData" :lineName="'Average Profit Made By Trip Length'"/>
    </el-row>
    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1>Average Profit Made By Time Day By Trip Length in Miles (Afternoon) </h1>
      <line-chart :chart-data="afternoonData" :lineName="'Average Profit Made By Trip Length'"/>
    </el-row>
    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1>Average Profit Made By Time Day By Trip Length in Miles (Night) </h1>
      <line-chart :chart-data="nightData" :lineName="'Average Profit Made By Trip Length'"/>
    </el-row>
    <el-row style="background:#fff;padding:16px 16px 0;margin-bottom:32px;">
      <h1>Uber Average Earnings per Trip in different cities</h1>
      <bar-chart :chart-data="averageProfitPerTripByCityData" />
    </el-row>
  </div>
</template>

<script>
  import fs from 'browserify-fs';
  import { mapGetters } from 'vuex'
  import firebase from 'firebase'
  import { getuid, setuid, removeuid } from '@/utils/auth'
  var db = firebase.firestore();
  import { CChartBar } from '@coreui/coreui-vue-chartjs'
  import TripsChart from '@/views/charts/Trips'
  import LineChart from '@/views/charts/LineChart'
  import LineChart3 from '@/views/charts/LineChartThreeLines'
  import BarChart from '@/views/charts/BarChart'
  import Table from '@/views/charts/Table'

  import {
    averageProfitByTripLength,
    averageProfitByTimeDayByTripLength,
    averageProfitPerTripByHoursWorkedPerWeek,
    averageProfitPerTripByCity,
    uberTakeRateByLength,
    sumRiderTotal,
    sumDriverTotal,
    sumUberTotal,
    sumOtherTotal,
    computeDriverShareTotal,
    computeDriverShareByTrip,
    computeUberShareTotal,
    computeUberShareByTrip,
    computeOtherShareTotal,
    computeOtherShareByTrip} from './calculate';

  const lineChartData = {
    takeRateByTripLength: {
      xaxis: [100, 120, 161, 134, 105, 160, 165],
      values: [120, 82, 91, 154, 162, 140, 145]
    }
  }

  export default {
  name: 'Dashboard',
  components: {
    CChartBar,
    TripsChart,
    LineChart,
    LineChart3,
    BarChart,
    Table
  },
  created() {
    // getAllDriverData();
    console.log(db);
    console.log('uid:', getuid());
  },
  data() {
    return {
      uid: getuid(),
      tripData: [],
      averageProfitByTripLengthData: {labels: [], data: []},
      averageProfitByTimeDayByTripLengthData: {labels: [], data: []},
      averageProfitPerTripByHoursWorkedPerWeekData: {labels: [], data: []},
      averageProfitPerTripByCityData: {labels: [], data: []},
      uberTakeRateByLengthData: {labels: [], data: []},
      morningData: {labels: [], data: []},
      afternoonData: {labels: [], data: []},
      nightData: {labels: [], data: []},
      sumRiderTotalData: 0,
      sumDriverTotalData: 0,
      sumUberTotalData: 0,
      sumOtherTotalData: 0,
      computeDriverShareTotalData: 0,
      computeDriverShareByTripData: {'average': 0},
      computeUberShareTotalData: 0,
      computeUberShareByTripData: {'average': 0},
      computeOtherShareTotalData: 0,
      computeOtherShareByTripData: {'average': 0}
    }
  },
  methods: {
    async getAllDriverData() {
      const snapshot = await db.collection('drivers').doc(getuid()).collection('trips').get()
      console.log("snapshot", snapshot.docs.map(doc => doc.data()));
      this.tripData = snapshot.docs.map(doc => doc.data());
    },
    displayData() {
      let gasPrice = 2.573
      let mpg = 30
      this.averageProfitByTripLengthData = averageProfitByTripLength(this.tripData);
      this.averageProfitByTimeDayByTripLengthData = averageProfitByTimeDayByTripLength(this.tripData, gasPrice, mpg);

      let label = this.averageProfitByTimeDayByTripLengthData.label
      this.morningData = {label: label, data: this.averageProfitByTimeDayByTripLengthData.data[0]}
      this.afternoonData = {label: label, data: this.averageProfitByTimeDayByTripLengthData.data[1]}
      this.nightData = {label: label, data: this.averageProfitByTimeDayByTripLengthData.data[2]}

      this.averageProfitPerTripByHoursWorkedPerWeekData = averageProfitPerTripByHoursWorkedPerWeek(this.tripData, gasPrice, mpg);
      this.averageProfitPerTripByCityData = averageProfitPerTripByCity(this.tripData, gasPrice, mpg);
      this.uberTakeRateByLengthData = uberTakeRateByLength(this.tripData);
      this.sumRiderTotalData = sumRiderTotal(this.tripData);
      this.sumDriverTotalData = sumDriverTotal(this.tripData);
      this.sumUberTotalData = sumUberTotal(this.tripData);
      this.sumOtherTotalData = sumOtherTotal(this.tripData);
      this.computeDriverShareTotalData = computeDriverShareTotal(this.tripData);
      this.computeDriverShareByTripData = computeDriverShareByTrip(this.tripData);
      this.computeUberShareTotalData = computeUberShareTotal(this.tripData);
      this.computeUberShareByTripData = computeUberShareByTrip(this.tripData);
      this.computeOtherShareTotalData = computeOtherShareTotal(this.tripData);
      this.computeOtherShareByTripData = computeOtherShareByTrip(this.tripData);
      console.log(this.computeOtherShareByTripData['average']);
    },
    handleSetLineChartData(type) {
      this.lineChartData = lineChartData[type]
    }
  },
  computed: {
    dataset1 () {
      return []
    },
    ...mapGetters([
      'name'
    ])
  },
}


</script>

<style lang="scss" scoped>
.dashboard {
  &-container {
    margin: 30px;
  }
  &-text {
    font-size: 30px;
    line-height: 46px;
  }
}
.dashboard-editor-container {
  padding: 32px;
  background-color: rgb(240, 242, 245);
  position: relative;

  .github-corner {
    position: absolute;
    top: 0px;
    border: 0;
    right: 0;
  }

  .chart-wrapper {
    background: #fff;
    padding: 16px 16px 0;
    margin-bottom: 32px;
  }
}

@media (max-width:1024px) {
  .chart-wrapper {
    padding: 8px;
  }
}
</style>
