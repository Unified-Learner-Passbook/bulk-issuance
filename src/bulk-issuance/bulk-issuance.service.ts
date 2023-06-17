import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { AxiosRequestConfig } from 'axios';
import { Response } from 'express';
import { CredentialsService } from 'src/services/credentials/credentials.service';
import { SbrcService } from 'src/services/sbrc/sbrc.service';
import { TelemetryService } from 'src/services/telemetry/telemetry.service';
import { KeycloakService } from 'src/services/keycloak/keycloak.service';
import jwt_decode from 'jwt-decode';

@Injectable()
export class BulkIssuanceService {
  constructor(
    private credService: CredentialsService,
    private sbrcService: SbrcService,
    private telemetryService: TelemetryService,
    private keycloakService: KeycloakService,
    private readonly httpService: HttpService,
  ) {}

  fs = require('fs');
  parse = require('csv-parse');
  async = require('async');
  //getToken
  async getToken(username: string, password: string, response: Response) {
    let qs = require('qs');
    if (username && password) {
      let data = qs.stringify({
        client_id: 'registry-frontend',
        username: username,
        password: password,
        grant_type: 'password',
      });
      const url =
        process.env.KEYCLOAK_URL +
        'realms/sunbird-rc/protocol/openid-connect/token';
      const config: AxiosRequestConfig = {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      };
      let keycloak_response = null;
      try {
        const observable = this.httpService.post(url, data, config);
        const promise = observable.toPromise();
        const response = await promise;
        //console.log(JSON.stringify(response.data));
        keycloak_response = response.data;
      } catch (e) {
        //console.log(e);
        //keycloak_response = { error: e };
      }
      if (keycloak_response == null) {
        return response.status(400).send({
          success: false,
          status: 'keycloak_error',
          message: 'Error in Authentication',
          result: null,
        });
      } else {
        return response.status(200).send({
          success: true,
          status: 'request_success',
          message: 'Success',
          result: keycloak_response?.access_token
            ? keycloak_response.access_token
            : '',
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getDID
  async getDID(uniquetext: string, response: Response) {
    if (uniquetext) {
      const generateddid = await this.credService.generateDid(uniquetext);
      if (generateddid?.error) {
        return response.status(400).send({
          success: false,
          status: 'did_generate_error',
          message: 'Identity Generation Failed ! Please Try Again.',
          result: generateddid?.error,
        });
      } else {
        var did = generateddid[0].verificationMethod[0].controller;
        return response.status(200).send({
          success: true,
          status: 'did_success',
          message: 'DID Success',
          result: did,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getIssuerRegister
  async getIssuerRegister(
    token: string,
    name: string,
    email: string,
    mobile: string,
    userid: string,
    response: Response,
  ) {
    if (token && name && email && mobile && userid) {
      let jwt_decode = await this.parseJwt(token);
      let roles = jwt_decode?.realm_access?.roles
        ? jwt_decode.realm_access.roles
        : [];
      //check admin roles in jwt
      if (roles.includes('admin')) {
        //check keycloak token
        const tokenUsername = await this.keycloakService.verifyUserToken(token);
        if (tokenUsername?.error) {
          return response.status(401).send({
            success: false,
            status: 'keycloak_token_bad_request',
            message: 'You do not have access for this request.',
            result: null,
          });
        } else if (!tokenUsername?.preferred_username) {
          return response.status(400).send({
            success: false,
            status: 'keycloak_token_error',
            message: 'Your Login Session Expired.',
            result: null,
          });
        } else {
          let data = JSON.stringify({
            name: name,
            email: email,
            mobile: mobile,
            userid: userid,
          });
          const url = process.env.REGISTRY_URL + 'api/v1/Issuer/invite';
          const config: AxiosRequestConfig = {
            headers: {
              'content-type': 'application/json',
              Authorization: 'Bearer ' + token,
            },
          };
          var sb_rc_response_text = null;
          try {
            const observable = this.httpService.post(url, data, config);
            const promise = observable.toPromise();
            const response = await promise;
            //console.log(JSON.stringify(response.data));
            sb_rc_response_text = response.data;
          } catch (e) {
            //console.log(e);
            sb_rc_response_text = { error: e };
          }
          if (sb_rc_response_text?.error) {
            return response.status(400).send({
              success: false,
              status: 'sb_rc_register_error',
              message: 'System Register Error ! Please try again.',
              result: sb_rc_response_text?.error,
            });
          } else if (sb_rc_response_text?.params?.status === 'SUCCESSFUL') {
            return response.status(200).send({
              success: true,
              status: 'issuer_register',
              message: 'Issuer Registered',
              result: sb_rc_response_text,
            });
          } else {
            return response.status(400).send({
              success: false,
              status: 'sb_rc_register_duplicate',
              message: 'Duplicate Data Found.',
              result: sb_rc_response_text,
            });
          }
        }
      } else {
        return response.status(400).send({
          success: false,
          status: 'invalid_request',
          message: 'Invalid Keycloak Token',
          result: null,
        });
      }
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  //getUploadFiles
  async getUploadFiles(csvfile, response: Response) {
    if (csvfile) {
      var inputFile = csvfile.originalname;

      var csvData = [];
      this.fs
        .createReadStream(inputFile)
        .pipe(this.parse())
        .on('data', function (data) {
          try {
            console.log('username ' + data.username);
            //perform the operation
          } catch (err) {
            //error handler
          }
        })
        .on('end', function () {
          //some final operation
        });
      /*fs.createReadStream(csvfile.path)
        .pipe(parse({ delimiter: ':' }))
        .on('data', function (csvrow) {
          console.log(csvrow);
          //do something with csvrow
          csvData.push(csvrow);
        })
        .on('end', function () {
          //do something with csvData
          console.log(csvData);
        });*/
      return response.status(200).send({
        success: true,
        status: 'file_receive',
        message: 'File Received',
        result: csvfile,
      });
    } else {
      return response.status(400).send({
        success: false,
        status: 'invalid_request',
        message: 'Invalid Request. Not received All Parameters.',
        result: null,
      });
    }
  }

  async issueBulkCredential(
    credentialPlayload: any,
    schemaId: string,
    type: string,
    response: Response,
  ) {
    console.log('credentialPlayload: ', credentialPlayload);
    console.log('schemaId: ', schemaId);

    var issuerId = '';

    // find or create issuerId
    //find udise in rc
    let searchSchema = {
      filters: {
        udiseCode: {
          eq: credentialPlayload.issuerDetail.udise,
        },
      },
    };
    //let searchSchoolDetail = await this.sbrcSearch(searchSchema, 'SchoolDetail')
    let searchSchoolDetail = await this.sbrcService.sbrcSearch(
      searchSchema,
      'SchoolDetail',
    );
    console.log('searchSchoolDetail', searchSchoolDetail);

    if (searchSchoolDetail.length > 0) {
      issuerId = searchSchoolDetail[0].did;
      console.log('issuerId', issuerId);
    } else {
      //let schoolDidRes = await this.generateDid(credentialPlayload.issuerDetail.udise)
      let schoolDidRes = await this.credService.generateDid(
        credentialPlayload.issuerDetail.udise,
      );
      console.log('schoolDidRes', schoolDidRes);

      if (schoolDidRes) {
        credentialPlayload.issuerDetail.schoolDid =
          schoolDidRes[0].verificationMethod[0].controller;
        //create schoolDetail in rc

        let inviteSchema = {
          schoolName: credentialPlayload.issuerDetail.schoolName,
          udiseCode: credentialPlayload.issuerDetail.udise,
          did: credentialPlayload.issuerDetail.schoolDid,
        };
        //let createSchoolDetail = await this.sbrcInvite(inviteSchema, 'SchoolDetail')
        let createSchoolDetail = await this.sbrcService.sbrcInvite(
          inviteSchema,
          'SchoolDetail',
        );
        console.log('createSchoolDetail', createSchoolDetail);

        if (createSchoolDetail) {
          issuerId = credentialPlayload.issuerDetail.schoolDid;
          console.log('issuerId', issuerId);
        } else {
          return response.status(200).send({
            success: false,
            status: 'sb_rc_register_error',
            message: 'System Register Error ! Please try again.',
            result: null,
          });
        }
      } else {
        return response.status(200).send({
          success: false,
          status: 'did_generate_error',
          message: 'Identity Generation Failed ! Please Try Again.',
          result: null,
        });
      }
    }

    //generate schema
    //var schemaRes = await this.generateSchema(schemaId);
    var schemaRes = await this.credService.generateSchema(schemaId);
    console.log('schemaRes', schemaRes);

    if (schemaRes) {
      var responseArray = [];

      // bulk import
      for (const iterator of credentialPlayload.credentialSubject) {
        if (credentialPlayload.credentialSubjectCommon.grade) {
          iterator.grade = credentialPlayload.credentialSubjectCommon.grade;
        }
        if (credentialPlayload.credentialSubjectCommon.academic_year) {
          iterator.academic_year =
            credentialPlayload.credentialSubjectCommon.academic_year;
        }
        if (credentialPlayload.credentialSubjectCommon.benefitProvider) {
          iterator.benefitProvider =
            credentialPlayload.credentialSubjectCommon.benefitProvider;
        }
        if (credentialPlayload.credentialSubjectCommon.schemeName) {
          iterator.schemeName =
            credentialPlayload.credentialSubjectCommon.schemeName;
        }
        if (credentialPlayload.credentialSubjectCommon.schemeId) {
          iterator.schemeId =
            credentialPlayload.credentialSubjectCommon.schemeId;
        }
        if (credentialPlayload.credentialSubjectCommon.assessment) {
          iterator.assessment =
            credentialPlayload.credentialSubjectCommon.assessment;
        }
        if (credentialPlayload.credentialSubjectCommon.quarterlyAssessment) {
          iterator.quarterlyAssessment =
            credentialPlayload.credentialSubjectCommon.quarterlyAssessment;
        }
        if (credentialPlayload.credentialSubjectCommon.total) {
          iterator.total = credentialPlayload.credentialSubjectCommon.total;
        }
        //list of schema update fields
        if (credentialPlayload.issuerDetail.schoolName) {
          iterator.school_name = credentialPlayload.issuerDetail.schoolName;
        }
        if (credentialPlayload.issuerDetail.udise) {
          iterator.school_id = credentialPlayload.issuerDetail.udise;
        }
        if (credentialPlayload.credentialSubjectCommon.stateCode) {
          iterator.stateCode =
            credentialPlayload.credentialSubjectCommon.stateCode;
        }
        if (credentialPlayload.credentialSubjectCommon.stateName) {
          iterator.stateName =
            credentialPlayload.credentialSubjectCommon.stateName;
        }
        if (credentialPlayload.credentialSubjectCommon.districtCode) {
          iterator.districtCode =
            credentialPlayload.credentialSubjectCommon.districtCode;
        }
        if (credentialPlayload.credentialSubjectCommon.districtName) {
          iterator.districtName =
            credentialPlayload.credentialSubjectCommon.districtName;
        }
        if (credentialPlayload.credentialSubjectCommon.blockCode) {
          iterator.blockCode =
            credentialPlayload.credentialSubjectCommon.blockCode;
        }
        if (credentialPlayload.credentialSubjectCommon.blockName) {
          iterator.blockName =
            credentialPlayload.credentialSubjectCommon.blockName;
        }

        //generate did or find did
        var aadhar_token = iterator.aadhar_token;

        // find student
        let name = iterator.student_name;
        let dob = iterator.dob;
        let searchSchema = {
          filters: {
            student_name: {
              eq: name,
            },
            dob: {
              eq: dob,
            },
          },
        };
        //const studentDetails = await this.sbrcSearch(searchSchema, 'StudentV2')
        const studentDetails = await this.sbrcService.sbrcSearch(
          searchSchema,
          'StudentV2',
        );
        console.log('studentDetails', studentDetails);

        if (studentDetails.length > 0) {
          if (studentDetails[0]?.DID) {
            iterator.id = studentDetails[0].DID;
            let obj = {
              issuerId: issuerId,
              credSchema: schemaRes,
              credentialSubject: iterator,
              issuanceDate: credentialPlayload.vcData.issuanceDate,
              expirationDate: credentialPlayload.vcData.expirationDate,
            };
            console.log('obj', obj);

            //const cred = await this.issueCredentials(obj)
            const cred = await this.credService.issueCredentials(obj);
            //console.log("cred 34", cred)
            if (cred) {
              responseArray.push(cred);

              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-issued',
              });
            } else {
              responseArray.push({
                student_name: iterator.student_name,
                dob: iterator.dob,
                error: 'unable to issue credentials!',
              });
              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-failed',
              });
            }
          } else {
            //let didRes = await this.generateDid(aadhar_token)
            let didRes = await this.credService.generateDid(aadhar_token);

            if (didRes) {
              iterator.id = didRes[0].verificationMethod[0].controller;
              //let updateRes = await this.sbrcUpdate({ DID: iterator.id }, 'StudentV2', studentDetails[0].osid)
              let updateRes = await this.sbrcService.sbrcUpdate(
                { DID: iterator.id },
                'StudentV2',
                studentDetails[0].osid,
              );
              if (updateRes) {
                let obj = {
                  issuerId: issuerId,
                  credSchema: schemaRes,
                  credentialSubject: iterator,
                  issuanceDate: credentialPlayload.vcData.issuanceDate,
                  expirationDate: credentialPlayload.vcData.expirationDate,
                };
                console.log('obj', obj);

                if (iterator.id) {
                  //const cred = await this.issueCredentials(obj)
                  const cred = await this.credService.issueCredentials(obj);
                  //console.log("cred 34", cred)
                  if (cred) {
                    responseArray.push(cred);
                    //telemetry service called
                    this.telemetryService.telemetry({
                      id: iterator.id,
                      student_name: iterator.student_name,
                      dob: iterator.dob,
                      type: type,
                      result: 'credentials-issued',
                    });
                  } else {
                    responseArray.push({
                      student_name: iterator.student_name,
                      dob: iterator.dob,
                      error: 'unable to issue credentials!',
                    });

                    //telemetry service called
                    this.telemetryService.telemetry({
                      id: iterator.id,
                      student_name: iterator.student_name,
                      dob: iterator.dob,
                      type: type,
                      result: 'credentials-failed',
                    });
                  }
                }
              } else {
                responseArray.push({
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  error: 'unable to update did inside RC!',
                });
                //telemetry service called
                this.telemetryService.telemetry({
                  id: iterator.id,
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  type: type,
                  result: 'credentials-failed',
                });
              }
            } else {
              responseArray.push({
                student_name: iterator.student_name,
                dob: iterator.dob,
                error: 'unable to generate student did!',
              });

              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-failed',
              });
            }
          }
        } else {
          //let didRes = await this.generateDid(aadhar_token)
          console.log('aadhar_token  205', aadhar_token);
          if (aadhar_token) {
            let didRes = await this.credService.generateDid(aadhar_token);

            if (didRes) {
              iterator.id = didRes[0].verificationMethod[0].controller;
              let inviteSchema = {
                student_id: iterator.student_id,
                DID: iterator.id,
                reference_id: iterator.reference_id,
                aadhar_token: iterator.aadhar_token,
                student_name: iterator.student_name,
                dob: iterator.dob,
                school_type: 'public',
                meripehchan_id: '',
                username: (
                  iterator.student_name.split(' ')[0] +
                  '@' +
                  iterator.dob.split('/').join('')
                ).toLowerCase(),
                aadhaar_status: 'verified',
                aadhaar_enc: '',
                gender: iterator?.gender ? iterator.gender : '',
                school_udise: iterator.school_id,
                school_name: iterator.school_name,
                stateCode: iterator.stateCode,
                stateName: iterator.stateName,
                districtCode: iterator.districtCode,
                districtName: iterator.districtName,
                blockCode: iterator.blockCode,
                blockName: iterator.blockName,
              };
              console.log('inviteSchema', inviteSchema);
              //let createStudent = await this.sbrcInvite(inviteSchema, 'StudentV2')
              let createStudent = await this.sbrcService.sbrcInvite(
                inviteSchema,
                'StudentV2',
              );
              console.log('createStudent', createStudent);

              if (createStudent) {
                let obj = {
                  issuerId: issuerId,
                  credSchema: schemaRes,
                  credentialSubject: iterator,
                  issuanceDate: credentialPlayload.vcData.issuanceDate,
                  expirationDate: credentialPlayload.vcData.expirationDate,
                };
                console.log('obj', obj);

                //const cred = await this.issueCredentials(obj)
                const cred = await this.credService.issueCredentials(obj);
                //console.log("cred 34", cred)
                if (cred) {
                  responseArray.push(cred);
                  //telemetry service called
                  this.telemetryService.telemetry({
                    id: iterator.id,
                    student_name: iterator.student_name,
                    dob: iterator.dob,
                    type: type,
                    result: 'credentials-issued',
                  });
                } else {
                  responseArray.push({
                    student_name: iterator.student_name,
                    dob: iterator.dob,
                    error: 'unable to issue credentials!',
                  });

                  //telemetry service called
                  this.telemetryService.telemetry({
                    id: iterator.id,
                    student_name: iterator.student_name,
                    dob: iterator.dob,
                    type: type,
                    result: 'credentials-failed',
                  });
                }
              } else {
                responseArray.push({
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  error: 'unable to create student in RC!',
                });

                //telemetry service called
                this.telemetryService.telemetry({
                  id: iterator.id,
                  student_name: iterator.student_name,
                  dob: iterator.dob,
                  type: type,
                  result: 'credentials-failed',
                });
              }
            } else {
              responseArray.push({
                student_name: iterator.student_name,
                dob: iterator.dob,
                error: 'unable to generate student did!',
              });

              //telemetry service called
              this.telemetryService.telemetry({
                id: iterator.id,
                student_name: iterator.student_name,
                dob: iterator.dob,
                type: type,
                result: 'credentials-failed',
              });
            }
          } else {
            responseArray.push({
              student_name: iterator.student_name,
              dob: iterator.dob,
              error: 'aadhar_token not found!',
            });

            //telemetry service called
            this.telemetryService.telemetry({
              id: iterator.id,
              student_name: iterator.student_name,
              dob: iterator.dob,
              type: type,
              result: 'credentials-failed',
            });
          }
        }
      }

      //bulk import response
      console.log('responseArray.length', responseArray.length);
      if (responseArray.length > 0) {
        return response.status(200).send({
          success: true,
          status: 'student_cred_bulk_api_success',
          message: 'Student Cred Bulk API Success.',
          result: responseArray,
        });
      } else {
        return response.status(200).send({
          success: false,
          status: 'did_cred_generate_error',
          message:
            'User Identity and Credentials Generation Failed. Try Again.',
          result: null,
        });
      }
    } else {
      return response.status(200).send({
        success: false,
        status: 'did_cred_generate_error',
        message: 'User Identity and Credentials Generation Failed. Try Again.',
        result: null,
      });
    }
  }

  //helper function
  //get jwt token information
  parseJwt = async (token): Promise<any> => {
    if (!token) {
      return {};
    }
    const decoded = jwt_decode(token);
    return decoded;
  };
}
