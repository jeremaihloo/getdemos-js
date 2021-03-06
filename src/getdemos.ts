/* eslint-disable no-undef */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'
import { stringify } from 'query-string'
import compareVersions from 'compare-versions'
import { LoginModel, AppRelease, App, Article, Tag, Pagination } from './getdemos.models'
import { Query, CheckUpdateResult } from './api.models.t'

export interface ApiMessage<T = any> {
  ok: boolean
  code: number
  msg: string
  data: T
}

export class AppQuery {
  pageIndex: number = 0
  pageSize: number = 10

  toString(): string {
    return stringify(this)
  }
}

export class AppQueryParam {
  appId?: number
  name?: string

  constructor(appId?: number, name?: string) {
    this.appId = appId
    this.name = name
  }

  toString(): string {
    return stringify(this)
  }
}

export interface Invitation {
  id: number
  code: string
  userId: number
  appId: number
}

export interface GetDemosConfigOpts {
  debug?: boolean
  storage?: DefaultStorage
  axiosConfigs?: AxiosRequestConfig
}

export const GETDEMOS_TOKEN = 'getdemos-token'

export class DefaultStorage {
  get = async () => {
    return localStorage.getItem(GETDEMOS_TOKEN)
  }

  set = async (token: string) => {
    return localStorage.setItem(GETDEMOS_TOKEN, token)
  }
}
export default class GetDemos {
  client: AxiosInstance
  storage: DefaultStorage

  constructor(opts: GetDemosConfigOpts) {
    this.client = axios.create(opts.axiosConfigs)

    this.storage = opts.storage || new DefaultStorage()

    this.client.interceptors.request.use(
      async configs => {
        const token = await this.storage.get()
        if (token !== null) {
          configs.headers.Authorization = `Bearer ${token}`
        }
        opts.debug && console.log('[request] ', configs)
        return configs
      },
      error => {
        // Do something with request error
        opts.debug && console.log('[request:error] ', error)
        return Promise.reject({
          ok: false,
          msg: error
        })
      }
    )

    this.client.interceptors.response.use(
      response => {
        opts.debug && console.log('[response] ', response)
        switch (response.status) {
          case 500:
            return Promise.reject({
              ok: false,
              msg: '服务器内部错误'
            })
        }
        if (response.data.ok) {
          return response
        } else {
          return Promise.reject(response)
        }
      },
      error => {
        // Do something with request error
        opts.debug && console.log('[responnse:error] ', error)
        return Promise.reject(error.response)
      }
    )
  }

  /**
   * 登录
   * @param payload 登录模型
   */
  async doLogin(payload: LoginModel) {
    const res = await this.client.post<ApiMessage<string>>('/api/auth', payload)
    if (res.data.ok) {
      await this.storage.set(res.data.data)
    }
    return res
  }

  /**
   * 获取所有APP
   * @param payload 查询条件
   */
  async getAllApps(payload: AppQuery) {
    return this.client.get<ApiMessage<App[]>>(`/api/apps?${payload.toString()}`)
  }

  /**
   * 获取APP详情
   * @param appQueryParams APP参数
   */
  async getAppInfo(appQueryParams: AppQueryParam) {
    return this.client.get<ApiMessage<App>>(`/api/apps/info?id=${appQueryParams.toString()}`)
  }

  /**
   * 获取APP最后一次发布的版本
   * @param appQueryParams APP查询参数
   */
  async getAppLatestRelease(appQueryParams: AppQueryParam) {
    return this.client.get<ApiMessage<AppRelease>>(
      `/api/apps/releases/latest${appQueryParams.toString()}`
    )
  }

  /**
   * 获取APP所有版本
   * @param appQueryParams APP查询参数
   */
  async getAllAppReleases(appQueryParams: AppQueryParam) {
    return this.client.get<ApiMessage<AppRelease[]>>(
      `/api/apps/releases?id=${appQueryParams.toString()}`
    )
  }

  /**
   * 发布一个新版本
   * @param payload 发布版本信息
   */
  async releaseNewVersion(payload: AppRelease) {
    return this.client.post<ApiMessage<AppRelease>>('/api/apps/releases', payload)
  }

  /**
   * 生成邀请码
   * @param appId 为APP生成一个新的邀请码
   */
  async getInvitation(appId: number) {
    return this.client.get<ApiMessage<Invitation>>(`/api/apps/invitation?appId=${appId}`)
  }

  /**
   * 确认邀请
   * @param payload 邀请码内容
   */
  async confirmInvitation(payload: Invitation) {
    await this.client.post<ApiMessage<Invitation>>('/api/apps/invitation', payload)
  }

  /**
   * 创建APP
   * @param payload APP详情
   */
  async createApp(payload: App) {
    return this.client.post<ApiMessage<App>>('/api/apps', payload)
  }

  /**
   * 检查更新
   * @param versionCode 版本构建代码
   * @param versionName 版本号
   */
  async checkUpdate(versionName: string, versionCode?: string): Promise<CheckUpdateResult> {
    const latestRelease = await this.getAppLatestRelease({})
    const result: CheckUpdateResult = {}
    if (compareVersions(latestRelease.data.data.version, versionName) === 1) {
      result.latest = false
      result.release = latestRelease.data.data
    } else {
      result.latest = true
    }
    return Promise.resolve(result)
  }

  getArticle = (id: number) => {
    return this.client.get<ApiMessage<Article>>(`/api/articles/${id}`)
  }

  getArticles = (query: Query) => {
    return this.client.get<ApiMessage<Pagination<Article>>>(`/api/articles?${query.toString()}`)
  }

  createArticle = (article: Article) => {
    return this.client.post(`/api/articles`, article)
  }

  updateArticle = (id: number, article: Article) => {
    return this.client.put(`/api/articles?id=${id}`, article)
  }

  removeArticleById = (id: number) => {
    return this.client.delete(`/api/articles/${id}`)
  }

  getTags = () => {
    return this.client.get<ApiMessage<Tag>>(`/api/tags`)
  }
}
