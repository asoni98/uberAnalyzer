<template>
  <el-table :data="tableData" style="width: 100%;padding-top: 15px;">
    <el-table-column label="Order_No" min-width="200">
      <template slot-scope="row">
        {{ row.Distance }}
      </template>
    </el-table-column>
    <el-table-column label="Price" width="195" align="center">
      <template slot-scope="row">
        ¥{{ row.Dropoff_City }}
      </template>
    </el-table-column>
    <el-table-column label="Status" width="100" align="center">
      <template slot-scope="{row}">
        <el-tag :type="row.Dropoff_Time">
          {{ row.status }}
        </el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>

<script>
  import echarts from 'echarts'

  export default {
    props: {
      width: {
        type: String,
        default: '100%'
      },
      height: {
        type: String,
        default: '300px'
      },
      tableData: {
        type: Object,
        required: true
      }
    },
    watch: {
      tableData: {
        deep: true,
        handler(val) {
          this.setOptions(val)
        }
      }
    },
    filters: {
      statusFilter(status) {
        const statusMap = {
          success: 'success',
          pending: 'danger'
        }
        return statusMap[status]
      },
      orderNoFilter(str) {
        return str.substring(0, 30)
      }
    },
    data() {
      return {
        list: null
      }
    },
    created() {
      this.initTable()
    },
    methods: {
      initTable() {
        this.chart = echarts.init(this.$el, 'macarons')
        this.setOptions(this.tableData)
      },
      setOptions(data) {
        console.log(data)
      }
    }
  }
</script>
